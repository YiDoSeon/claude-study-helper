// 기본 분야 트리. 세부 주제는 화면에서 자유롭게 덧붙인다.
export const TOPICS = [
  {
    id: 'lang',
    label: '프로그래밍 언어',
    children: ['C', 'C++', 'C#', 'Java', 'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'Kotlin'],
  },
  {
    id: 'ds',
    label: '자료구조',
    children: ['배열과 연결 리스트', '스택과 큐', '해시 테이블', '트리와 이진 탐색 트리', '균형 트리', '힙과 우선순위 큐', '그래프 표현', '트라이', '유니온 파인드', '세그먼트 트리'],
  },
  {
    id: 'algo',
    label: '알고리즘',
    children: ['시간·공간 복잡도', '정렬', '이분 탐색', '재귀와 분할 정복', '그리디', '동적 계획법', 'BFS와 DFS', '최단 경로', '최소 신장 트리', '위상 정렬', '문자열 알고리즘', '투 포인터와 슬라이딩 윈도우', '비트 연산'],
  },
  {
    id: 'math',
    label: '수학',
    children: ['이산수학', '논리와 증명', '조합론', '정수론', '선형대수', '확률과 통계', '미적분 기초', '그래프 이론', '게임 수학(벡터·행렬·쿼터니언)'],
  },
  {
    id: 'net',
    label: '네트워크',
    children: ['OSI와 TCP/IP 계층', 'TCP와 UDP', 'IP와 라우팅', 'DNS', 'HTTP와 HTTPS', 'TLS', '소켓 프로그래밍', '웹소켓', '로드 밸런싱과 CDN', '게임 네트워크(동기화·지연 보정)'],
  },
  {
    id: 'os',
    label: '운영체제',
    children: ['프로세스와 스레드', 'CPU 스케줄링', '동기화와 교착 상태', '메모리 관리', '가상 메모리와 페이징', '파일 시스템', '입출력과 인터럽트', '시스템 콜'],
  },
  {
    id: 'arch',
    label: '컴퓨터 구조',
    children: ['수 표현과 부동소수점', '논리 회로', 'CPU와 명령어 집합', '파이프라인', '캐시와 메모리 계층', 'SIMD와 병렬성'],
  },
  {
    id: 'db',
    label: '데이터베이스',
    children: ['관계형 모델', 'SQL', '정규화', '인덱스', '트랜잭션과 격리 수준', '동시성 제어', 'NoSQL'],
  },
  {
    id: 'se',
    label: '소프트웨어 설계',
    children: ['객체지향 원칙(SOLID)', '디자인 패턴', '함수형 프로그래밍', '테스트', '리팩터링', '버전 관리(Git)', '아키텍처 패턴'],
  },
  {
    id: 'pl',
    label: '프로그래밍 언어 이론',
    children: ['타입 시스템', '메모리 관리와 GC', '컴파일러 구조', '동시성 모델', '클로저와 스코프'],
  },
  {
    id: 'sec',
    label: '보안 기초',
    children: ['암호화와 해시', '인증과 인가', '웹 보안 취약점', '메모리 안전성'],
  },
];

export const DIFFICULTIES = ['입문', '기초', '중급', '심화'];

export const QUESTION_TYPES = [
  { id: 'auto', label: '자동' },
  { id: 'multiple_choice', label: '객관식' },
  { id: 'short_answer', label: '단답형' },
  { id: 'code_reading', label: '코드 읽기' },
  { id: 'explain', label: '서술형' },
];

export const CUSTOM_CATEGORY_ID = 'custom';
export const CUSTOM_CATEGORY_LABEL = '내 주제';
