// دالة مساعدة: تاخد الصورة الأصلية + منطقة القص المختارة، وترجع صورة مقصوصة (Blob) جاهزة للرفع

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.src = url;
  });
}

export async function getCroppedImageBlob(
  imageSrc: string,
  cropArea: CropArea,
  outputSize = 512
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر إنشاء الصورة");

  // ارسم دائرة (اختياري بصريًا في المعاينة فقط) — هنا بنرسم القص كمربع كامل
  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("فشل إنشاء الصورة المقصوصة"));
      },
      "image/jpeg",
      0.92
    );
  });
}
