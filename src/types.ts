export type User = 'kia' | 'mohamad';

export type Upload = {
  id: string;
  user: User;
  youtube_url: string;
  video_id: string;
  title: string | null;
  thumbnail: string | null;
  author: string | null;
  note: string;
  uploaded_at: string;
  published_week: string;
  published_month: string;
  upload_score: number;
  quality_score: number | null;
};

export type UploadsResponse = {
  kia: Upload[];
  mohamad: Upload[];
};
