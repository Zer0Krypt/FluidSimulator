#!/bin/bash

git clean -fd
gh repo sync
npm run dev
#npm install
#npm start