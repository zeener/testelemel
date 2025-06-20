"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
console.log('Starting test server...');
var app = (0, express_1.default)();
var PORT = 3002; // Use a different port to avoid conflicts
app.get('/', function (req, res) {
    res.send('Test server is running!');
});
// Start the server
var server = app.listen(PORT, '0.0.0.0', function () {
    console.log("Test server is running on http://localhost:".concat(PORT));
    console.log('Test server started successfully at', new Date().toISOString());
});
// Keep the process alive
var keepAlive = setInterval(function () {
    console.log('Test server keep-alive at', new Date().toISOString());
}, 10000); // Log every 10 seconds
// Handle server errors
server.on('error', function (error) {
    console.error('Test server error:', error);
});
// Handle process termination
process.on('SIGINT', function () {
    console.log('\nSIGINT received. Shutting down test server...');
    clearInterval(keepAlive);
    server.close(function () {
        console.log('Test server closed');
        process.exit(0);
    });
});
console.log('Test server initialization complete');
