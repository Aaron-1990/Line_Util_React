const fs = require('fs');
const path = require('path');

module.exports = {
  postStart: async () => {
    const migrationsSource = path.join(__dirname, 'src/main/database/migrations');
    const migrationsDest = path.join(__dirname, '.vite/build/migrations');

    if (!fs.existsSync(migrationsDest)) {
      fs.mkdirSync(migrationsDest, { recursive: true });
    }

    const files = fs.readdirSync(migrationsSource).filter(f => f.endsWith('.sql'));
    
    files.forEach(file => {
      const source = path.join(migrationsSource, file);
      const dest = path.join(migrationsDest, file);
      fs.copyFileSync(source, dest);
      console.log(`Copied migration: ${file}`);
    });
  },
};
