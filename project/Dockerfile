FROM node:carbon

VOLUME /usr/vannot/project/src
VOLUME /usr/vannot/build
WORKDIR /usr/vannot/project
RUN [ "ln", "-s", "../build", "lib" ]

COPY package.json /usr/vannot/project/package.json
COPY package-lock.json /usr/vannot/project/package-lock.json
COPY Makefile /usr/vannot/project

RUN [ "npm", "install" ]

ENTRYPOINT [ "make" ]

