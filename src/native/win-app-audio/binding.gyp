{
  "targets": [
    {
      "target_name": "win_app_audio",
      "sources": [ "win_app_audio.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        [ "OS=='win'", {
          "libraries": [ "-luser32", "-lkernel32" ]
        }]
      ]
    }
  ]
}
