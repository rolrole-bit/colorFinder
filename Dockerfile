FROM node:22-alpine

WORKDIR /app

# 의존성 먼저 복사 (Docker 캐시 레이어 최적화)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 소스 복사
COPY . .

# data 디렉토리 생성
RUN mkdir -p data && echo '[]' > data/rankings.json

# 불필요 파일 제거
RUN rm -rf tools/ docs/ src/test/ .git/ .gitignore *.md *.bat *.hta *.zip 2>/dev/null || true

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server/index.js"]
