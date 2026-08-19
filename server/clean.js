const { execSync } = require('child_process');

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== process.pid.toString()) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`[Port Clean] Successfully freed port ${port} (Killed PID ${pid})`);
          } catch (e) {}
        }
      }
    } else {
      execSync(`lsof -t -i:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch (e) {}
}

// Automatically clear port 5173 (Vite) and port 5000 (Express CRM Server)
killPort(5173);
killPort(5000);
