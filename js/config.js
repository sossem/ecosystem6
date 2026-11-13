/* =====================================================
   지구 지킴이 뉴스룸 - 교사 설정 파일
   이 파일의 값만 바꾸면 앱 동작이 바뀝니다.
   ===================================================== */

const CONFIG = {
  /* 앱 이름 (상단 로고와 시작 화면에 표시) */
  appName: "지구 지킴이 뉴스룸",

  /* "캔바 열기" 버튼이 여는 주소.
     학급 템플릿 링크(예: https://www.canva.com/design/xxxx/edit)로 바꿔 쓰세요. */
  canvaUrl: "https://www.canva.com",

  /* 다음 단계로 넘어가기 위한 스크랩 조건 */
  scrapRule: {
    minPerType: 1,   // 오염 종류(대기·수질·토양)마다 최소 몇 개
    minTotal: 3      // 전체 최소 몇 개
  },

  /* 퀴즈 */
  quiz: {
    count: 10,          // 한 번에 내는 문제 수
    retryWrong: true,   // 틀린 문제를 마지막에 다시 풀게 할지
    /* 문제 유형별 목표 개수. 합이 count보다 작으면 나머지는 "오염 종류 맞히기"로 채웁니다. */
    mix: {
      type: 5,      // 오염 종류 맞히기
      effect: 2,    // 영향 맞히기 (4지선다)
      chain: 1,     // 원인-오염-영향 순서대로 잇기
      ox: 1,        // OX 퀴즈
      initial: 1    // 초성 퀴즈
    }
  },

  /* 지구 지킴이 배지 기준 (맞힌 비율, %) */
  badges: [
    { min: 90, name: "지구 지킴이 대장", emoji: "🌍" },
    { min: 70, name: "지구 지킴이", emoji: "🌱" },
    { min: 0,  name: "지구 지킴이 새싹", emoji: "🌿" }
  ],

  /* 오염 종류 이름·색·그림 (색은 css/style.css의 변수와 맞춰 두었습니다) */
  types: {
    air:   { name: "대기오염", short: "대기", emoji: "🌫️", hint: "공기가 더러워져요" },
    water: { name: "수질오염", short: "수질", emoji: "🌊", hint: "물이 더러워져요" },
    soil:  { name: "토양오염", short: "토양", emoji: "🪱", hint: "흙이 더러워져요" }
  },

  /* localStorage 저장 키. 바꾸면 이전 기록이 보이지 않게 됩니다. */
  storageKey: "earthNewsroom.v2"
};
