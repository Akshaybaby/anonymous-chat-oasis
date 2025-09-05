import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageIcon, VideoIcon, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MediaUploadProps {
  onMediaUploaded: (url: string, type: 'image' | 'video') => void;
}

export const MediaUpload = ({ onMediaUploaded }: MediaUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File) => {
    if (!file) return;

    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
      onMediaUploaded(data.publicUrl, mediaType);

      toast({
        title: "Upload successful",
        description: `${mediaType} uploaded successfully!`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload media. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
        id="media-upload"
      />
      <label htmlFor="media-upload">
        <Button
          variant="outline"
          size="icon"
          disabled={uploading}
          className="cursor-pointer"
          asChild
        >
          <span>
            {uploading ? (
              <Upload className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </span>
        </Button>
      </label>
    </div>
  );
};
