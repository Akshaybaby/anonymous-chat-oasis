interface MessageRendererProps {
  content: string;
  messageType: string;
  mediaUrl?: string;
}

export const MessageRenderer = ({ content, messageType, mediaUrl }: MessageRendererProps) => {
  if (messageType === 'image' && mediaUrl) {
    return (
      <div className="space-y-2">
        <img 
          src={mediaUrl} 
          alt="Shared image" 
          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(mediaUrl, '_blank')}
        />
        {content && <p className="text-sm">{content}</p>}
      </div>
    );
  }

  if (messageType === 'video' && mediaUrl) {
    return (
      <div className="space-y-2">
        <video 
          src={mediaUrl} 
          controls 
          className="max-w-xs rounded-lg"
        />
        {content && <p className="text-sm">{content}</p>}
      </div>
    );
  }

  return <p className="text-sm">{content}</p>;
};