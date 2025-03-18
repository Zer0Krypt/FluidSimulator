#!/bin/bash

git clean -fd
rm -rf node_modules
rm -rf package-lock.json
gh repo sync
npm install
npm run dev
#npm install
#npm start