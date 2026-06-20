// Windows-only N-API addon: HWND -> application loopback device id.
// Logic ported from Chromium desktop_capture_devices_util_win.cc.

#include <napi.h>

#ifdef _WIN32

#include <windows.h>
#include <tlhelp32.h>

#include <algorithm>
#include <charconv>
#include <string>
#include <vector>

namespace {

constexpr DWORD kNullProcessId = 0;
constexpr wchar_t kApplicationFrameHost[] = L"ApplicationFrameHost.exe";
constexpr wchar_t kUwpCoreWindowClass[] = L"Windows.UI.Core.CoreWindow";

constexpr char kApplicationLoopbackPrefix[] = "applicationLoopback:";
constexpr char kRestrictOwnAudioPrefix[] = "restrictOwnAudioBrowserLoopback:";

bool ComparePathIgnoreCase(const std::wstring& a, const std::wstring& b) {
  if (a.size() != b.size()) {
    return false;
  }
  return _wcsicmp(a.c_str(), b.c_str()) == 0;
}

std::wstring GetWindowClassName(HWND hwnd) {
  wchar_t class_name[256] = {};
  const int len = GetClassNameW(hwnd, class_name, static_cast<int>(sizeof(class_name) / sizeof(class_name[0])));
  if (len <= 0) {
    return {};
  }
  return std::wstring(class_name, static_cast<size_t>(len));
}

DWORD GetParentProcessId(DWORD process_id) {
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return 0;
  }

  PROCESSENTRY32W entry = {};
  entry.dwSize = sizeof(entry);

  DWORD parent_id = 0;
  if (Process32FirstW(snapshot, &entry)) {
    do {
      if (entry.th32ProcessID == process_id) {
        parent_id = entry.th32ParentProcessID;
        break;
      }
    } while (Process32NextW(snapshot, &entry));
  }

  CloseHandle(snapshot);
  return parent_id;
}

std::wstring GetProcessExecutablePath(HANDLE process_handle) {
  std::wstring image_path(MAX_PATH, L'\0');
  DWORD path_length = static_cast<DWORD>(image_path.size());
  if (!QueryFullProcessImageNameW(process_handle, 0, image_path.data(), &path_length)) {
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER) {
      return {};
    }
    image_path.resize(32767);
    path_length = static_cast<DWORD>(image_path.size());
    if (!QueryFullProcessImageNameW(process_handle, 0, image_path.data(), &path_length)) {
      return {};
    }
  }
  image_path.resize(path_length);
  return image_path;
}

bool IsUwpApp(const std::wstring& app_path) {
  if (app_path.empty()) {
    return false;
  }

  wchar_t system_dir[MAX_PATH] = {};
  const UINT system_len = GetSystemDirectoryW(system_dir, MAX_PATH);
  if (system_len == 0 || system_len >= MAX_PATH) {
    return false;
  }

  const std::wstring system_path(system_dir, system_len);

  size_t last_sep = app_path.find_last_of(L"\\/");
  if (last_sep == std::wstring::npos) {
    return false;
  }

  const std::wstring parent = app_path.substr(0, last_sep);
  const std::wstring base = app_path.substr(last_sep + 1);

  return ComparePathIgnoreCase(parent, system_path) &&
         ComparePathIgnoreCase(base, kApplicationFrameHost);
}

struct UwpCoreWindowSearch {
  HWND core_window = nullptr;
};

BOOL CALLBACK FindUwpCoreWindowProc(HWND hwnd, LPARAM lparam) {
  auto* search = reinterpret_cast<UwpCoreWindowSearch*>(lparam);
  if (GetWindowClassName(hwnd) == kUwpCoreWindowClass) {
    search->core_window = hwnd;
    return FALSE;
  }
  return TRUE;
}

DWORD GetUwpAppCoreWindowProcessId(HWND hwnd) {
  UwpCoreWindowSearch search;
  EnumChildWindows(hwnd, FindUwpCoreWindowProc, reinterpret_cast<LPARAM>(&search));
  if (!search.core_window) {
    return kNullProcessId;
  }

  DWORD main_process_id = 0;
  const DWORD thread_id = GetWindowThreadProcessId(search.core_window, &main_process_id);
  if (!thread_id || !main_process_id) {
    return kNullProcessId;
  }

  return main_process_id;
}

DWORD GetGenericAppRootProcessId(DWORD process_id,
                                 HANDLE process_handle,
                                 const std::wstring& app_path) {
  DWORD main_process_id_candidate = process_id;
  DWORD parent_id = GetParentProcessId(process_id);
  if (parent_id <= 0) {
    return main_process_id_candidate;
  }

  HANDLE parent_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, parent_id);
  while (parent_handle) {
    const std::wstring parent_path = GetProcessExecutablePath(parent_handle);
    CloseHandle(parent_handle);

    if (parent_path.empty()) {
      return main_process_id_candidate;
    }

    if (!ComparePathIgnoreCase(parent_path, app_path)) {
      return main_process_id_candidate;
    }

    main_process_id_candidate = parent_id;
    parent_id = GetParentProcessId(parent_id);
    if (parent_id <= 0) {
      break;
    }

    parent_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, parent_id);
  }

  return main_process_id_candidate;
}

DWORD GetAppMainProcessId(intptr_t window_id) {
  HWND hwnd = reinterpret_cast<HWND>(window_id);
  if (!hwnd || !IsWindow(hwnd)) {
    return kNullProcessId;
  }

  DWORD process_id = 0;
  const DWORD thread_id = GetWindowThreadProcessId(hwnd, &process_id);
  if (!thread_id || !process_id) {
    return kNullProcessId;
  }

  HANDLE process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
  if (!process_handle) {
    return kNullProcessId;
  }

  const std::wstring app_path = GetProcessExecutablePath(process_handle);
  CloseHandle(process_handle);

  if (IsUwpApp(app_path)) {
    return GetUwpAppCoreWindowProcessId(hwnd);
  }

  process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
  if (!process_handle) {
    return kNullProcessId;
  }

  const DWORD main_process_id =
      GetGenericAppRootProcessId(process_id, process_handle, app_path);
  CloseHandle(process_handle);
  return main_process_id;
}

bool ParseWindowNativeId(const std::string& source_id, intptr_t* out_window_id) {
  // DesktopCapturerSource.id format: window:<native_id>:<window_id>
  if (source_id.rfind("window:", 0) != 0) {
    return false;
  }

  const size_t first_colon = source_id.find(':');
  const size_t second_colon = source_id.find(':', first_colon + 1);
  if (first_colon == std::string::npos || second_colon == std::string::npos) {
    return false;
  }

  const std::string native_id = source_id.substr(first_colon + 1, second_colon - first_colon - 1);
  if (native_id.empty()) {
    return false;
  }

  long long window_id = 0;
  const char* begin = native_id.data();
  const char* end = begin + native_id.size();
  const auto result = std::from_chars(begin, end, window_id);
  if (result.ec != std::errc() || result.ptr != end) {
    return false;
  }

  *out_window_id = static_cast<intptr_t>(window_id);
  return true;
}

std::string MakeDeviceId(const char* prefix, DWORD pid) {
  return std::string(prefix) + std::to_string(pid);
}

}  // namespace

Napi::Value NapiGetCurrentProcessId(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Number::New(env, static_cast<double>(::GetCurrentProcessId()));
}

Napi::Value ResolveApplicationLoopbackDeviceId(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected desktopCapturerSourceId string")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  const std::string source_id = info[0].As<Napi::String>().Utf8Value();
  bool restrict_own_audio = false;
  if (info.Length() >= 2 && info[1].IsObject()) {
    Napi::Object options = info[1].As<Napi::Object>();
    if (options.Has("restrictOwnAudio") && options.Get("restrictOwnAudio").IsBoolean()) {
      restrict_own_audio = options.Get("restrictOwnAudio").As<Napi::Boolean>().Value();
    }
  }

  intptr_t window_id = 0;
  if (!ParseWindowNativeId(source_id, &window_id)) {
    return env.Null();
  }

  const DWORD main_pid = GetAppMainProcessId(window_id);
  if (main_pid == kNullProcessId) {
    return env.Null();
  }

  const DWORD current_pid = ::GetCurrentProcessId();
  if (restrict_own_audio && main_pid == current_pid) {
    return Napi::String::New(env, MakeDeviceId(kRestrictOwnAudioPrefix, current_pid));
  }

  return Napi::String::New(env, MakeDeviceId(kApplicationLoopbackPrefix, main_pid));
}

Napi::Value IsOwnApplicationWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected desktopCapturerSourceId string")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  intptr_t window_id = 0;
  if (!ParseWindowNativeId(info[0].As<Napi::String>().Utf8Value(), &window_id)) {
    return Napi::Boolean::New(env, false);
  }

  const DWORD main_pid = GetAppMainProcessId(window_id);
  if (main_pid == kNullProcessId) {
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, main_pid == ::GetCurrentProcessId());
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("getCurrentProcessId", Napi::Function::New(env, NapiGetCurrentProcessId));
  exports.Set("resolveApplicationLoopbackDeviceId",
              Napi::Function::New(env, ResolveApplicationLoopbackDeviceId));
  exports.Set("isOwnApplicationWindow", Napi::Function::New(env, IsOwnApplicationWindow));
  return exports;
}

NODE_API_MODULE(win_app_audio, Init)

#else

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return exports;
}

NODE_API_MODULE(win_app_audio, Init)

#endif
