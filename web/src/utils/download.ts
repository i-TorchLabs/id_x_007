/**
 *
 * 下载文件
 *
 * @example download('http://www.baidu.com/img/bd_logo1.png', 'logo.png')
 */
export function download(link: string, name?: string) {
  if (!name) name = link.slice(link.lastIndexOf("/") + 1);

  const eleLink = document.createElement("a");
  eleLink.download = name;
  eleLink.style.display = "none";
  eleLink.href = link;
  eleLink.target = "_blank";
  document.body.appendChild(eleLink);
  eleLink.click();
  document.body.removeChild(eleLink);
}

/**
 * 将 base64 内容保存为文件下载（对应后端 FileResponse）
 */
export function downloadBase64(name: string, base64: string) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)]);
  const url = URL.createObjectURL(blob);
  const eleLink = document.createElement("a");
  eleLink.download = name;
  eleLink.style.display = "none";
  eleLink.href = url;
  document.body.appendChild(eleLink);
  eleLink.click();
  document.body.removeChild(eleLink);
  URL.revokeObjectURL(url);
}
