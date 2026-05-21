# 꿈비 그룹 · 네이버 카페 경쟁사 모니터링

꿈비 그룹(유아용품)의 경쟁사(나리몽, 도노도노, 아토팜, 루나스토리) 네이버 카페 동향을 Claude API **web_search**로 수집·분석하는 웹앱입니다.

## 기능

- 키워드 다중 입력 (추가/삭제)
- 정렬: 최신순 / 관련도순
- Claude web_search로 네이버 카페 게시글 수집
- 공개 콘텐츠 / 로그인 필요 항목 분리 표시
- AI 인사이트 (관심사, 긍·부정 키워드, 즉시 대응 액션)
- 노션 붙여넣기용 리포트 복사

## 시작하기

### 1. 의존성 설치

```bash
cd naver-cafe-monitor
npm install
```

### 2. 환경 변수

`.env.example`을 복사해 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

`.env.local`에 Anthropic API 키를 설정합니다.

```
ANTHROPIC_API_KEY=sk-ant-...
```

> Claude Console에서 **웹 검색(Web Search)** 기능이 활성화되어 있어야 합니다.  
> [설정 → Privacy](https://platform.claude.com/settings/privacy)

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 기술 스택

- Next.js 15 (App Router)
- Tailwind CSS
- Anthropic SDK (`web_search_20250305`)

## API

`POST /api/monitor`

```json
{
  "keywords": ["나리몽", "아토팜"],
  "sortOrder": "latest"
}
```

## 주의사항

- 네이버 카페 회원 전용·로그인 필요 게시글은 자동 수집이 제한됩니다. 해당 항목은 **팀원 직접 확인 필요** 섹션에 표시됩니다.
- 검색 결과는 Claude web_search의 실시간 검색 품질에 따라 달라질 수 있습니다.
