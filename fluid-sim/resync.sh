#!/bin/bash

git clean -fd
rm -rf node_modules
rm -rf package-lock.json
gh repo sync
npm run dev # dev
#npm run build # prod
#npm start # prod