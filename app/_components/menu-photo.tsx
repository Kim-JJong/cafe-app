/** 음료 사진. 등록된 사진이 없으면 줄무늬 자리 표시 (디자인의 "음료 사진" 영역) */
export function MenuPhoto({ url, className }: { url: string | null; className: string }) {
  if (url) {
    // 사진 경로는 메뉴 데이터에 들어 있는 사내 경로라 next/image 최적화 없이 표시
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${className} object-cover`} />;
  }
  return <div aria-hidden className={`${className} photo-placeholder shrink-0`} />;
}
