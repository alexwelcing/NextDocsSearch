import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Upload, X, Check, AlertCircle, Image as ImageIcon, Video as VideoIcon, Lock } from 'lucide-react';
import {
  MediaType,
  validateMediaFile,
  STORAGE_CONFIG,
  ArticleMediaWithUrl,
} from '@/types/article-media';

/**
 * Admin interface for uploading article media
 */

const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
  padding: 40px 20px;
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const PageTitle = styled.h1`
  font-size: 2.5rem;
  color: #ffffff;
  margin-bottom: 10px;
  text-align: center;
`;

const PageDescription = styled.p`
  color: #b8b8b8;
  text-align: center;
  margin-bottom: 40px;
  font-size: 1.1rem;
`;

const UploadCard = styled.div`
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 16px;
  padding: 40px;
  margin-bottom: 30px;
`;

const FormGroup = styled.div`
  margin-bottom: 24px;
`;

const Label = styled.label`
  display: block;
  color: #00d4ff;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }

  &::placeholder {
    color: #666;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }

  &::placeholder {
    color: #666;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }

  option {
    background: #1a1a2e;
    color: #ffffff;
  }
`;

const FileDropZone = styled.div<{ $isDragging: boolean; $hasFile: boolean }>`
  border: 2px dashed ${props => props.$isDragging ? '#00d4ff' : props.$hasFile ? '#4ade80' : 'rgba(0, 212, 255, 0.3)'};
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  background: ${props => props.$isDragging ? 'rgba(0, 212, 255, 0.1)' : 'rgba(0, 0, 0, 0.3)'};
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #00d4ff;
    background: rgba(0, 212, 255, 0.05);
  }
`;

const FileInput = styled.input`
  display: none;
`;

const DropZoneContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const IconWrapper = styled.div<{ $type?: 'success' | 'error' }>`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: ${props =>
    props.$type === 'success' ? 'rgba(74, 222, 128, 0.2)' :
    props.$type === 'error' ? 'rgba(239, 68, 68, 0.2)' :
    'rgba(0, 212, 255, 0.2)'
  };
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props =>
    props.$type === 'success' ? '#4ade80' :
    props.$type === 'error' ? '#ef4444' :
    '#00d4ff'
  };
  margin-bottom: 8px;
`;

const DropZoneText = styled.p`
  color: #e0e0e0;
  font-size: 1.1rem;
  margin: 0;
`;

const DropZoneHint = styled.p`
  color: #888;
  font-size: 0.9rem;
  margin: 0;
`;

const FileName = styled.div`
  color: #4ade80;
  font-weight: 600;
  margin-top: 8px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 16px 32px;
  background: linear-gradient(135deg, #00d4ff 0%, #0096ff 100%);
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0, 212, 255, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Alert = styled.div<{ $type: 'success' | 'error' | 'info' }>`
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${props =>
    props.$type === 'success' ? 'rgba(74, 222, 128, 0.15)' :
    props.$type === 'error' ? 'rgba(239, 68, 68, 0.15)' :
    'rgba(0, 212, 255, 0.15)'
  };
  border: 1px solid ${props =>
    props.$type === 'success' ? 'rgba(74, 222, 128, 0.3)' :
    props.$type === 'error' ? 'rgba(239, 68, 68, 0.3)' :
    'rgba(0, 212, 255, 0.3)'
  };
  color: ${props =>
    props.$type === 'success' ? '#4ade80' :
    props.$type === 'error' ? '#ef4444' :
    '#00d4ff'
  };
`;

const PreviewSection = styled.div`
  margin-top: 40px;
`;

const PreviewTitle = styled.h2`
  font-size: 1.5rem;
  color: #ffffff;
  margin-bottom: 20px;
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 400px;
  border-radius: 12px;
  border: 2px solid rgba(0, 212, 255, 0.2);
`;

const MediaUploadPage: React.FC = () => {
  // API Key management
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [articleSlug, setArticleSlug] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [zIndex, setZIndex] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<ArticleMediaWithUrl | null>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('admin_api_key');
    if (stored) {
      setApiKey(stored);
    }
  }, []);

  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('admin_api_key', apiKey);
    } else {
      localStorage.removeItem('admin_api_key');
    }
  }, [apiKey]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validation = validateMediaFile(droppedFile, mediaType);
      if (validation.valid) {
        setFile(droppedFile);
        setAlert(null);
      } else {
        setAlert({ type: 'error', message: validation.error || 'Invalid file' });
      }
    }
  }, [mediaType]);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validation = validateMediaFile(selectedFile, mediaType);
      if (validation.valid) {
        setFile(selectedFile);
        setAlert(null);
      } else {
        setAlert({ type: 'error', message: validation.error || 'Invalid file' });
      }
    }
  }, [mediaType]);

  // Handle upload
  const handleUpload = async () => {
    if (!apiKey) {
      setAlert({ type: 'error', message: 'Please enter your admin API key' });
      return;
    }

    if (!file || !articleSlug) {
      setAlert({ type: 'error', message: 'Please select a file and enter an article slug' });
      return;
    }

    setUploading(true);
    setAlert(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('article_slug', articleSlug);
      formData.append('media_type', mediaType);
      formData.append('display_order', displayOrder.toString());
      formData.append('position_x', positionX.toString());
      formData.append('position_y', positionY.toString());
      formData.append('scale', scale.toString());
      formData.append('rotation', rotation.toString());
      formData.append('z_index', zIndex.toString());
      if (title) formData.append('title', title);
      if (altText) formData.append('alt_text', altText);
      if (caption) formData.append('caption', caption);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': apiKey,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setAlert({ type: 'success', message: 'Media uploaded successfully!' });
        setUploadedMedia(data.media);
        // Reset form
        setFile(null);
        setTitle('');
        setAltText('');
        setCaption('');
      } else {
        setAlert({ type: 'error', message: data.error || 'Upload failed' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setAlert({ type: 'error', message: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const config = STORAGE_CONFIG.limits[mediaType];

  return (
    <PageContainer>
      <ContentWrapper>
        <PageTitle>Article Media Upload</PageTitle>
        <PageDescription>
          Upload images and videos for the desk surface experience
        </PageDescription>

        {/* Security Warning */}
        <Alert $type="info">
          <Lock size={20} />
          <div>
            <strong>Secure Admin Area:</strong> This page requires an admin API key to upload files.
            Your API key is stored locally in your browser.
          </div>
        </Alert>

        {alert && (
          <Alert $type={alert.type}>
            {alert.type === 'success' && <Check size={20} />}
            {alert.type === 'error' && <AlertCircle size={20} />}
            {alert.type === 'info' && <AlertCircle size={20} />}
            {alert.message}
          </Alert>
        )}

        <UploadCard>
          <FormGroup>
            <Label>Admin API Key *</Label>
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your admin API key"
              required
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '6px',
                color: '#00d4ff',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {showApiKey ? 'Hide' : 'Show'} API Key
            </button>
          </FormGroup>

          <FormGroup>
            <Label>Article Slug *</Label>
            <Input
              type="text"
              value={articleSlug}
              onChange={(e) => setArticleSlug(e.target.value)}
              placeholder="e.g., my-article-slug"
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Media Type *</Label>
            <Select
              value={mediaType}
              onChange={(e) => {
                setMediaType(e.target.value as MediaType);
                setFile(null); // Reset file when changing type
              }}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>Upload File *</Label>
            <FileDropZone
              $isDragging={isDragging}
              $hasFile={!!file}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <FileInput
                id="file-input"
                type="file"
                accept={config.allowedTypes.join(',')}
                onChange={handleFileChange}
              />
              <DropZoneContent>
                <IconWrapper $type={file ? 'success' : undefined}>
                  {file ? (
                    <Check size={32} />
                  ) : mediaType === 'image' ? (
                    <ImageIcon size={32} />
                  ) : (
                    <VideoIcon size={32} />
                  )}
                </IconWrapper>
                <DropZoneText>
                  {file ? 'File selected!' : 'Drop file here or click to browse'}
                </DropZoneText>
                <DropZoneHint>
                  Max {config.maxSizeMB}MB • {config.allowedTypes.join(', ')}
                </DropZoneHint>
                {file && <FileName>{file.name}</FileName>}
              </DropZoneContent>
            </FileDropZone>
          </FormGroup>

          <FormGroup>
            <Label>Title (Optional)</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Media title"
            />
          </FormGroup>

          <FormGroup>
            <Label>Alt Text (Recommended for Images)</Label>
            <Input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Descriptive alt text for accessibility"
            />
          </FormGroup>

          <FormGroup>
            <Label>Caption (Optional)</Label>
            <TextArea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption text that appears on hover"
            />
          </FormGroup>

          <FormRow>
            <FormGroup>
              <Label>Display Order</Label>
              <Input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                min="0"
              />
            </FormGroup>

            <FormGroup>
              <Label>Position X (%)</Label>
              <Input
                type="number"
                value={positionX}
                onChange={(e) => setPositionX(parseFloat(e.target.value) || 50)}
                min="0"
                max="100"
                step="1"
              />
            </FormGroup>

            <FormGroup>
              <Label>Position Y (%)</Label>
              <Input
                type="number"
                value={positionY}
                onChange={(e) => setPositionY(parseFloat(e.target.value) || 50)}
                min="0"
                max="100"
                step="1"
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>Scale</Label>
              <Input
                type="number"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value) || 1.0)}
                min="0.3"
                max="2.5"
                step="0.1"
              />
            </FormGroup>

            <FormGroup>
              <Label>Rotation (degrees)</Label>
              <Input
                type="number"
                value={rotation}
                onChange={(e) => setRotation(parseFloat(e.target.value) || 0)}
                min="-180"
                max="180"
                step="5"
              />
            </FormGroup>

            <FormGroup>
              <Label>Z-Index</Label>
              <Input
                type="number"
                value={zIndex}
                onChange={(e) => setZIndex(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
              />
            </FormGroup>
          </FormRow>

          <SubmitButton onClick={handleUpload} disabled={uploading || !file || !articleSlug}>
            {uploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Upload size={20} />
                Upload Media
              </>
            )}
          </SubmitButton>
        </UploadCard>

        {uploadedMedia && uploadedMedia.media_type === 'image' && (
          <PreviewSection>
            <PreviewTitle>Preview</PreviewTitle>
            <PreviewImage src={uploadedMedia.public_url} alt={uploadedMedia.alt_text || 'Preview'} />
          </PreviewSection>
        )}
      </ContentWrapper>
    </PageContainer>
  );
};

export default MediaUploadPage;
