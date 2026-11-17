# ICE MELT

얼음을 두드려 NPC가 PC에게 숨겨 둔 속마음을 깨우고, 마지막에 남는 눈 결정으로 마음을 감정하는 OOC 결과 뷰어 — 빌드 없는 HTML/CSS/JavaScript.

**https://yuuuulll35.github.io/ice-malt/**

## 사용법

OOC는 답이 끊기지 않도록 두 번에 나눠 보낸다. ②는 같은 채팅에 이어서 보낸다.

| 단계 | 받는 내용 |
|---|---|
| OOC ① 해동 기록 | 대상, 처음 얼음의 두께(1~5), 시점별 속마음, 마지막 본심 |
| OOC ② 눈 결정 감정 | 결정 이름, 처음 마음이 맺힌 순간, 여섯 가지 마음, 마음의 색, 숨긴 이유와 남는 이유, 속마음 |

1. **OOC 복사** → 롤플 중인 채팅에 보내기 → 받은 답을 **답 붙여넣기**(또는 **직접 붙여넣기** 후 **입력 완료**).
2. 두 단계가 완료되면 **해동 시작**. 얼음을 연타해 깨면 속마음이 하나씩 나온다.
3. 마지막 얼음이 깨지면 눈 결정이 나타나고, **감정서 받기**로 결과지를 연다.
4. 결과지에서 **이미지로 저장**하면 공유용 카드 한 장이 저장된다.

얼음 두께에 따라 얼음 조각 수와 단단함이 달라진다(살얼음 ~ 만년설). 눈 결정 모양은 여섯 가지 마음의 길이와 결로 정해지며, 1번 마음의 결이 결정 유형(깃털형·바늘형·육각판형·가시형·이슬형)이 된다.

**예시로 보기**는 예시 답으로 바로 시작한다. 마지막으로 본 결과는 이 브라우저(localStorage)에만 남아 **지난 해동 다시 보기**로 돌아온다.

## OOC 답 형식

```text
대상: NPC 이름 / PC 이름
얼음: 1~5 · 그 두께인 까닭
해동 1 [시점: 첫 만남] [감정: 감정 이름] (속마음: …)
본심: …
```

```text
결정: 결정의 이름 · 모습과 까닭
핵: …
가지 1 [이름: 방식 이름] [길이: 1~10] [결: 깃털] (설명: …)
빛깔: 색 이름 · 뜻
얼린 이유: …
녹지 않는 이유: …
속마음: …
```

결은 깃털, 곧음, 판, 가시, 이슬 중 하나.

## 폰트

모든 폰트는 SIL Open Font License 1.1을 따르며, 저장소에 포함되지 않고 Google Fonts에서 불러옵니다.

| 폰트 | 쓰임 | 저작권 | 제공 |
|---|---|---|---|
| Bagel Fat One | 로고, READY~ START! | © The Bagel Fat Project Authors | Google Fonts |
| Noto Serif KR | 제목, 본문 | © Google, Adobe | Google Fonts |
| IBM Plex Sans KR | 버튼, 안내 문구 | © IBM Corp. | Google Fonts |
| Martian Mono | 작은 영문 라벨 | © The Martian Mono Project Authors | Google Fonts |
| Cormorant Garamond | 영문 이탤릭, 번호, 따옴표 | © The Cormorant Project Authors | Google Fonts |
| Bodoni Moda | 영문 이탤릭 보조 | © The Bodoni Moda Project Authors | Google Fonts |

## 사용한 라이브러리

| 라이브러리 | 쓰임 | 라이선스 | 제공 |
|---|---|---|---|
| [html-to-image](https://github.com/bubkoo/html-to-image) 1.11.11 | 결과 카드를 이미지로 저장 | MIT, © 2017-2023 W.Y. | 저장소 포함(`js/vendor/`) |

효과음과 배경음악은 Web Audio로 합성하며 음원 파일을 쓰지 않습니다.
