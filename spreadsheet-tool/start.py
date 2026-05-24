"""Start the spreadsheet tool server and open the browser."""
import os
import sys
import webbrowser
import threading
import time


def main():
    print("=" * 50)
    print("  表格工具 v1.0")
    print("=" * 50)

    # Open browser after a short delay
    def open_browser():
        time.sleep(0.8)
        webbrowser.open("http://127.0.0.1:5000")

    threading.Thread(target=open_browser, daemon=True).start()

    from server import app
    print("\n  服务已启动: http://127.0.0.1:5000")
    print("  按 Ctrl+C 停止服务\n")
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
