#!/bin/bash

git clean -fd
gh repo sync
npm install
npm start