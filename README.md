# ICE MELT — 마음의 해동

NPC가 PC에게 마음을 열어 온 과정을 얼음 깨기로 풀어내는 감정 진단 시뮬레이션.

## 사용법

1. 첫 화면에서 **프롬프트 복사**를 눌러 진행 중인 채팅방에 붙여 넣는다.
2. AI가 출력한 JSON 코드 블록을 통째로 복사해 입력창에 붙여 넣는다.
3. **해동 시작** — 얼음을 연타해 깨뜨리면 속마음이 드러나고, 마지막에 결과지가 나온다.

데이터 없이 구경하려면 **샘플로 체험**을 누른다.

## 구조

- `index.html` — 화면 구성
- `css/style.css` — 스타일
- `js/data.js` — 진단 프롬프트, 샘플 데이터
- `js/app.js` — 얼음 깨기, 사운드 합성, 형상 생성, 결과지

빌드 과정 없는 정적 사이트. 효과음은 Web Audio로 합성하며 별도 음원 파일을 쓰지 않는다.

## 폰트

Google Fonts에서 불러오며 모두 SIL Open Font License 1.1을 따른다.

- Unbounded — © The Unbounded Project Authors
- Gowun Batang, Gowun Dodum — © Yanghee Ryu
