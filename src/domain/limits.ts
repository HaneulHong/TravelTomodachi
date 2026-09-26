/**
 * 입력 글자 수 상한 — DB 제약과 같은 숫자다.
 *
 * 앱 입력칸의 maxLength로 쓴다. 저장을 누른 뒤에야 서버 오류로 알게 되면 늦다.
 * DB 쪽: supabase/schema.sql(제목·이름 등 표를 만들 때 건 것), expenses.sql, collab.sql,
 * limits.sql(나머지). **한쪽을 바꾸면 다른 쪽도 바꾼다.**
 */
export const LIMITS = {
  tripName: 60,
  itemTitle: 120,
  placeName: 200,
  itemMemo: 2000,
  carrierCode: 40,
  bookingRef: 60,
  cityLabel: 30,
  checklistTitle: 120,
  expenseTitle: 60,
  ideaName: 120,
  ideaNote: 500,
  comment: 500,
} as const;
