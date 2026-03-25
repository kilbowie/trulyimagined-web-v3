'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Image as ImageIcon, Music, Video, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type MediaType = 'headshot' | 'audio_reel' | 'video_reel';

interface UploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  success: boolean;
  error: string | null;
}

export default function UploadMediaPage() {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType>('headshot');
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    preview: null,
    uploading: false,
    success: false,
    error: null,
  });
  
  const [title, setTitle] = useState('');
  const [photoCredit, setPhotoCredit] = useState('');
  const [description, setDescription] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaTypeConfig = {
    headshot: {
      icon: ImageIcon,
      label: 'Headshots',
      accept: 'image/jpeg,image/jpg,image/png,image/webp',
      maxSize: '10MB',
      description: 'Upload professional headshots for your profile',
      placeholder: true,
      comingSoon: false,
    },
    audio_reel: {
      icon: Music,
      label: 'Audio Reels',
      accept: 'audio/mpeg,audio/mp3,audio/wav,audio/ogg',
      maxSize: '50MB',
      description: 'Coming soon: Upload voice samples and audio reels',
      placeholder: true,
      comingSoon: true,
    },
    video_reel: {
      icon: Video,
      label: 'Video Reels',
      accept: 'video/mp4,video/webm,video/quicktime',
      maxSize: '500MB',
      description: 'Coming soon: Upload video showreels and clips',
      placeholder: true,
      comingSoon: true,
    },
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    // Create preview for images
    if (mediaType === 'headshot') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadState({
          ...uploadState,
          file,
          preview: reader.result as string,
          error: null,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setUploadState({
        ...uploadState,
        file,
        preview: null,
        error: null,
      });
    }
  };

  const handleUpload = async () => {
    if (!uploadState.file) return;

    setUploadState({ ...uploadState, uploading: true, error: null });

    try {
      const formData = new FormData();
      formData.append('file', uploadState.file);
      formData.append('mediaType', mediaType);
      if (title) formData.append('title', title);
      if (photoCredit) formData.append('photoCredit', photoCredit);
      if (description) formData.append('description', description);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadState({
        file: null,
        preview: null,
        uploading: false,
        success: true,
        error: null,
      });

      // Reset form
      setTitle('');
      setPhotoCredit('');
      setDescription('');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Redirect to profile after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/profile');
      }, 2000);
    } catch (error) {
      setUploadState({
        ...uploadState,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  };

  const handleRemove = () => {
    setUploadState({
      file: null,
      preview: null,
      uploading: false,
      success: false,
      error: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const CurrentIcon = mediaTypeConfig[mediaType].icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Media</h1>
        <p className="text-muted-foreground mt-2">
          Upload headshots, audio reels, and video content for your profile
        </p>
      </div>

      {/* Media Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Media Type</CardTitle>
          <CardDescription>Choose what type of content you want to upload</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(mediaTypeConfig) as MediaType[]).map((type) => {
              const config = mediaTypeConfig[type];
              const Icon = config.icon;
              const isSelected = mediaType === type;

              return (
                <button
                  key={type}
                  onClick={() => !config.comingSoon && setMediaType(type)}
                  disabled={config.comingSoon}
                  className={`
                    relative p-6 rounded-lg border-2 transition-all text-left
                    ${isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                    }
                    ${config.comingSoon ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-6 w-6" />
                    <span className="font-semibold">{config.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">Max size: {config.maxSize}</p>
                  
                  {config.comingSoon && (
                    <Badge variant="secondary" className="absolute top-4 right-4">
                      Coming Soon
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      {!mediaTypeConfig[mediaType].comingSoon && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrentIcon className="h-5 w-5" />
              Upload {mediaTypeConfig[mediaType].label}
            </CardTitle>
            <CardDescription>
              Select a file and provide details about your {mediaType.replace('_', ' ')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload Area */}
            <div>
              <Label>File</Label>
              {!uploadState.file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">
                    {mediaTypeConfig[mediaType].accept.split(',').join(', ')} (max {mediaTypeConfig[mediaType].maxSize})
                  </p>
                </div>
              ) : (
                <div className="mt-2 border-2 border-border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    {uploadState.preview && (
                      <img
                        src={uploadState.preview}
                        alt="Preview"
                        className="w-24 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{uploadState.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadState.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemove}
                      disabled={uploadState.uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={mediaTypeConfig[mediaType].accept}
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload file"
              />
            </div>

            {/* Metadata Fields */}
            {uploadState.file && (
              <>
                <div>
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`e.g., ${mediaType === 'headshot' ? 'Studio Portrait' : 'Showreel 2024'}`}
                    className="mt-2"
                  />
                </div>

                {mediaType === 'headshot' && (
                  <div>
                    <Label htmlFor="photoCredit">Photo Credit (optional)</Label>
                    <Input
                      id="photoCredit"
                      value={photoCredit}
                      onChange={(e) => setPhotoCredit(e.target.value)}
                      placeholder="e.g., Photographer Name"
                      className="mt-2"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add notes or context about this file"
                    className="mt-2"
                    rows={3}
                  />
                </div>

                {/* Error Message */}
                {uploadState.error && (
                  <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                    <p className="text-sm text-destructive">{uploadState.error}</p>
                  </div>
                )}

                {/* Success Message */}
                {uploadState.success && (
                  <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Upload successful! Redirecting to profile...
                    </p>
                  </div>
                )}

                {/* Upload Button */}
                <Button
                  onClick={handleUpload}
                  disabled={uploadState.uploading || uploadState.success}
                  className="w-full"
                  size="lg"
                >
                  {uploadState.uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {mediaTypeConfig[mediaType].label}
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
