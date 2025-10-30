#!/usr/bin/env python3

import http.server
import socketserver
import argparse
import os

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

def main():
    parser = argparse.ArgumentParser(description='Run a simple http server with no-cache headers')
    parser.add_argument('-p','--port', type=int, default=8000, required=False, help='the port to serve to. Defaults to 8000.')
    parser.add_argument('-d','--directory', type=str, default='../html', required=False, help='the directory to serve. Defaults to ../html.')
    args = parser.parse_args()

    if not os.path.exists(args.directory):
        print(f"Error: Directory '{args.directory}' does not exist")
        return

    # Change to the target directory
    os.chdir(args.directory)

    with socketserver.TCPServer(("", args.port), MyHTTPRequestHandler) as httpd:
        print(f"serving at http://127.0.0.1:{args.port}")
        print(f"serving files from: {os.getcwd()}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()