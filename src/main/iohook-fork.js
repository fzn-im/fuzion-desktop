function handleIoHookInit() {
  const ioHook = require('iohook');
  // ioHook.start(true);
  ioHook.start(false);
  
  ioHook.on('mousedown', (data) => {
    process.send({ type: 'mousedown', data });
  });
  
  ioHook.on('mouseup', (data) => {
    process.send({ type: 'mouseup', data });
  });
  
  ioHook.on('keydown', (data) => {
    process.send({ type: 'keydown', data });
  });
  
  ioHook.on('keyup', (data) => {
    process.send({ type: 'keyup', data });
  });
  
  ioHook.on('devicedown', (data) => {
    process.send({ type: 'devicedown', data });
  });
  
  ioHook.on('deviceup', (data) => {
    process.send({ type: 'deviceup', data });
  });
}

handleIoHookInit();
