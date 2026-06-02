// Simple logging hook for debugging remote client errors in development
(function() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const sendLog = (level, args) => {
    const msg = args.map(arg => {
      if (arg instanceof Error) return arg.message + '\n' + arg.stack;
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch (e) { return String(arg); }
      }
      return String(arg);
    }).join(' ');
    
    // Fire and forget send
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message: msg })
    }).catch(() => {});
  };

  console.log = function(...args) {
    originalLog.apply(console, args);
    sendLog('LOG', args);
  };

  console.error = function(...args) {
    originalError.apply(console, args);
    sendLog('ERROR', args);
  };

  console.warn = function(...args) {
    originalWarn.apply(console, args);
    sendLog('WARN', args);
  };

  window.addEventListener('error', function(event) {
    sendLog('CRASH', [event.error || event.message]);
  });

  window.addEventListener('unhandledrejection', function(event) {
    sendLog('UNHANDLED', [event.reason || 'Unhandled Promise Rejection']);
  });
})();
