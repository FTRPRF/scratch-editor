# Scratch-editor: The Scratch Editor Monorepo

## How to get it up and running

To get it up and running do the following (tested in a linux environment):

**Make sure you use node 24.**  Eg:
```bash
nvm install 24
nvm use 24
```

In the project root
```bash
npm install
npm run build
```

In /packages/scratch-gui
```bash
npm run start
```

Once the scratch gui is started, go to http://localhost:8601/ to see the scratch gui.
