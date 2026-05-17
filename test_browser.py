import urllib.request
import json
import time

try:
    req = urllib.request.urlopen("http://localhost:8000")
    html = req.read().decode('utf-8')
    print("HTML loaded, length:", len(html))
except Exception as e:
    print("Error loading:", e)

