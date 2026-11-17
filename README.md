# ICE MELT — 마음의 해동

NPC가 PC에게 마음을 열어 온 과정을 얼음 깨기로 풀어내는 감정 진단 시뮬레이션.

## 사용법

OOC는 답이 길어져 끊기지 않도록 두 번에 나눠 보낸다. ②는 같은 채팅에 이어서 보낸다.

1. **OOC ①**(해동 기록): 대상, 얼음이 깨질 때 나올 속마음 8~12개, 본심
2. **OOC ②**(사랑의 온도): 온도, 하트 컬러, 애정의 형상과 구성, 결정적인 순간, 본질, 속마음

단계마다 **OOC 복사** → 채팅에 보내기 → 받은 답을 통째로 복사해 **답 붙여넣기**. 둘 다 넣으면 **해동 시작**.

답이 확인되면 단계가 **✓ 완료**로 바뀌고 요약과 **다시 넣기 / 지우기**가 나온다. 빠진 항목이 있으면 알려 주고, OOC를 그대로 붙여 넣으면 답을 복사하라고 안내한다. 브라우저가 클립보드 읽기를 막으면 **직접 붙여넣기** 칸이 열린다.

**예시로 보기**는 예시 답으로 바로 시작한다. 마지막으로 본 결과는 브라우저(localStorage)에만 저장되어 **지난 해동 다시 보기**로 돌아온다.

## OOC 답 형식

```text
대상: NPC 이름 / PC 이름
해동 1 [감정: 감정 이름] (속마음: …)
본심: …
```

```text
온도: 00.0 °C · 풀이
색: #RRGGBB · 색 이름 · 의미
보조색: #RRGGBB
형상: 이름 · 설명
구성: 빛의 핵, 꽃잎 7, 고리, 별 5
순간: …
본질: …
속마음: …
```

구성에 쓸 수 있는 도형: 빛의 핵, 하트, 보석, 고리, 물결, 실타래, 꽃잎, 물방울, 빛살, 점, 별, 결정.

## 구조

- `index.html` — 화면 구성
- `css/style.css` — 스타일
- `js/data.js` — OOC 두 개, 예시 답
- `js/app.js` — 답 판독, 얼음 깨기, 사운드 합성, 형상 생성, 결과지

빌드 과정 없는 정적 사이트. 효과음은 Web Audio로 합성하며 음원 파일을 쓰지 않는다.

## 폰트

Google Fonts에서 불러오며 모두 SIL Open Font License 1.1을 따른다.

- Bagel Fat One — © The Bagel Fat Project Authors
- Bodoni Moda — © The Bodoni Moda Project Authors
- Hahmlet — © The Hahmlet Project Authors
- IBM Plex Sans KR — © IBM Corp.
- Martian Mono — © The Martian Mono Project Authors
