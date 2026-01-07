#!/bin/bash

set -e

npm i
npm run lint
npm run format
npm run test
npm run bundle
