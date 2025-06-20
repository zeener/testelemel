console.log('Simple test server starting...');
console.log('Process ID:', process.pid);

// Keep the process alive
setInterval(() => {
  console.log('Still running at', new Date().toISOString());
}, 5000);

console.log('Simple test server started');
