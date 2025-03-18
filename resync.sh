#!/bin/bash

git clean -fd
git restore package.json
gh repo sync
npm install
npm run dev -- --host