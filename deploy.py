import os
import ftplib
import re

def load_env():
    env = {}
    if not os.path.exists('.env'):
        return env
    with open('.env', 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, val = line.split('=', 1)
                env[key] = val
    return env

env = load_env()
host = env.get('FTP_HOST', '')
user = env.get('FTP_USER', '')
password = env.get('FTP_PASSWORD', '')
port = int(env.get('FTP_PORT', '21'))
path = env.get('FTP_PATH', '/')

# Clean up host if it's a URL
host = re.sub(r'^https?://', '', host)
host = re.sub(r'^ftp://', '', host)
if '/' in host:
    host = host.split('/', 1)[0]

def upload_dir(ftp, local_dir, remote_dir):
    for item in os.listdir(local_dir):
        # Ignore specific files/directories
        if item in ['.git', 'node_modules', '.env', '.gitignore', '.DS_Store', 'deploy.py', '__pycache__'] or item.endswith('.md'):
            continue
            
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}" if remote_dir != '.' else item
        
        if os.path.isfile(local_path):
            print(f"Uploading {local_path} to {remote_path}...")
            with open(local_path, 'rb') as f:
                ftp.storbinary(f"STOR {remote_path}", f)
        elif os.path.isdir(local_path):
            print(f"Creating directory {remote_path}...")
            try:
                ftp.mkd(remote_path)
            except ftplib.error_perm as e:
                # Ignore "Directory already exists" error
                if not str(e).startswith('550'):
                    raise
            
            upload_dir(ftp, local_path, remote_path)

try:
    print(f"Connecting to FTP server {host}:{port} with user {user}...")
    ftp = ftplib.FTP()
    # ftp.set_debuglevel(1) # Uncomment for debugging
    ftp.connect(host, port)
    ftp.login(user, password)
    
    print(f"Changing remote directory to {path}...")
    try:
        ftp.cwd(path)
    except ftplib.error_perm:
        print(f"Warning: Failed to change directory to {path}. Uploading to current directory.")
    
    print("Starting upload...")
    upload_dir(ftp, '.', '.')
    
    ftp.quit()
    print("Upload completed successfully! 🚀")
except Exception as e:
    print(f"An error occurred: {e}")
