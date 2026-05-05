import { v2 as cloudinary } from 'cloudinary';

let configured = false;

function configure() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export async function uploadBufferToCloudinary(
  buf: Buffer,
  options: { folder?: string; publicId?: string; tags?: string[] } = {},
): Promise<{ url: string; publicId: string; width: number; height: number }> {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? 'nextgen-growth',
        public_id: options.publicId,
        tags: options.tags,
        resource_type: 'image',
        overwrite: true,
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      },
    );
    stream.end(buf);
  });
}
