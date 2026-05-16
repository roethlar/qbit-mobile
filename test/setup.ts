// Test-time defaults. Must be set before any module that reads them at import.
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'basic';
process.env.APP_USERNAME = 'tester';
process.env.APP_PASSWORD = 'testpw';
process.env.QBITTORRENT_HOST = '127.0.0.1';
process.env.QBITTORRENT_PORT = '18080';
