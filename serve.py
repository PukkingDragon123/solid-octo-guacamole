#!/usr/bin/env python3
"""Tiny static server for DAM IT — ES modules need HTTP, not file://."""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'DAM IT is running at http://localhost:{PORT}  (ctrl-c to stop)')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nbye!')
