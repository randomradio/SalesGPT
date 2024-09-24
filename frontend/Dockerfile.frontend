# Use an official Node runtime as a parent image
FROM node:latest

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN yarn config delete registry
RUN yarn config set registry https://registry.npmmirror.com
RUN yarn install

ARG NEXT_PUBLIC_ENVIRONMENT=test
ARG NEXT_PUBLIC_API_URL=http://124.221.36.241:9021

ENV NEXT_PUBLIC_ENVIRONMENT=${NEXT_PUBLIC_ENVIRONMENT}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# 复制所有文件到工作目录
COPY . .

# 构建项目
RUN yarn build

# 暴露应用运行的端口
EXPOSE 3000

# 启动应用
CMD ["npm", "run", "start"]