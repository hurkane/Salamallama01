#!/bin/bash

# Rename docker-compose.yml to docker-compose.old.yml if it exists
if [ -f docker-compose.yml ]; then
  mv docker-compose.yml docker-compose.old.yml
  echo "Renamed existing docker-compose.yml to docker-compose.old.yml"
fi

# Rename clouddocker-compose.yml to docker-compose.yml
if [ -f clouddocker-compose.yml ]; then
  mv clouddocker-compose.yml docker-compose.yml
  echo "Renamed clouddocker-compose.yml to docker-compose.yml"
fi

# Rename nginx.conf to nginx.old.conf if it exists
if [ -f nginx.conf ]; then
  mv nginx.conf nginx.old.conf
  echo "Renamed existing nginx.conf to nginx.old.conf"
fi

# Rename cloudnginx.conf to nginx.conf
if [ -f cloudnginx.conf ]; then
  mv cloudnginx.conf nginx.conf
  echo "Renamed cloudnginx.conf to nginx.conf"
fi
