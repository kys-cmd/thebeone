import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Smile, 
  CalendarCheck, 
  ListTodo, 
  Vote, 
  Link as LinkIcon, 
  X, 
  Send,
  MoreHorizontal,
  AtSign,
  Hash,
  Paperclip,
  Plus,
  Bold,
  Italic,
  Heading2,
  List,
  Quote,
  Code2,
  Palette,
  Underline as UnderlineIcon,
  Strikethrough,
  ListOrdered,
  Undo,
  Redo
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from 'framer-motion';
import { communityService } from '@/services/communityService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Post } from '@/types';

// --- Types ---
interface PostEditorProps {
  communityId?: string;
  initialPost?: any;
  onSuccess?: (post: any) => void;
  onCancel?: () => void;
  onSubmit?: (data: { title: string; html: string; json: any }) => void;
  submitButtonText?: string;
}

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

const POPULAR_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🍕', '🍔', '🍟', 'ホットドッグ', '🥞', '🍩', '🍪', '🎂', '🧁', '🍦', '🍨', '🍧', '🍺', '🍻', '🥂', '🍾', '🍷', '🥃', '☕', '🥤', '🧉', '🧃', '🍗', '🥩', '🥓', '🍳', '🥞', '🍜', '🍝', '🍣', '🍤', '🍚', '🍙', '🍎', '🍓', '🍋', '🍒', '🍉', '🍇', '🥑', '🥦', '🥕', '🌽', '🌶️', '🧀', '🖐️', '✋', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🙏', '✍️', '💅', '🤳', '💪', '⚙️', '🔥', '✨', '🎈', '🎉', '💡', '⏰', '📌', '📍', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '🌟', '⚠️', '✅', '❌', '💯'
];

// --- Tiptap Extensions Configuration ---
const extensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  Placeholder.configure({
    placeholder: '이곳에 본문 내용을 입력하세요...',
  }),
  Link.configure({
    openOnClick: true,
    HTMLAttributes: {
      class: 'text-blue-600 font-semibold hover:underline cursor-pointer',
      target: '_blank',
      rel: 'noopener noreferrer'
    },
  }),
  Image.configure({
    HTMLAttributes: {
      class: 'rounded-lg max-w-full h-auto border border-slate-200 my-4 inline-block shadow-sm',
    },
  }),
  Mention.configure({
    HTMLAttributes: {
      class: 'text-purple-600 font-bold bg-purple-50 px-1 rounded',
    },
  }),
  TextStyle,
  Color,
  Underline,
];

const EDITOR_COLORS = [
  { name: '기본', color: '#1e293b', class: 'bg-slate-800' },
  { name: '빨강', color: '#ef4444', class: 'bg-red-500' },
  { name: '주황', color: '#f97316', class: 'bg-orange-500' },
  { name: '노랑', color: '#eab308', class: 'bg-yellow-500' },
  { name: '초록', color: '#10b981', class: 'bg-emerald-500' },
  { name: '파랑', color: '#3b82f6', class: 'bg-blue-500' },
  { name: '보라', color: '#6366f1', class: 'bg-indigo-500' },
  { name: '핑크', color: '#ec4899', class: 'bg-pink-500' },
];

export function PostEditor({ communityId, initialPost, onSuccess, onCancel, onSubmit, submitButtonText }: PostEditorProps) {
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<{ type: 'image' | 'video' | 'file', url: string, name?: string }[]>([]);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [activeWidget, setActiveWidget] = useState<'attendance' | 'todo' | 'poll' | null>(null);
  
  // Widget States
  const [attendanceConfig, setAttendanceConfig] = useState({ title: '오늘의 출석체크' });
  const [todoConfig, setTodoConfig] = useState({ title: '금일 할 일', items: [''] });
  const [pollConfig, setPollConfig] = useState({ question: '', options: ['', ''] });

  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const videoUploadInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const dialogLinkInputRef = useRef<HTMLInputElement>(null);

  // --- Autocomplete & Mention State ---
  const [searchState, setSearchState] = useState<{
    isOpen: boolean;
    trigger: string;
    query: string;
    range: { from: number; to: number } | null;
  }>({
    isOpen: false,
    trigger: '',
    query: '',
    range: null,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [members, setMembers] = useState<any[]>([]);

  // Refs for safe access inside editor closures
  const searchStateRef = useRef(searchState);
  searchStateRef.current = searchState;
  
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const list = await communityService.getAdminCommunityMembers(communityId || 'notices');
        if (list && list.length > 0) {
          setMembers(list);
        } else {
          // Fallback profiles from Supabase if no active course members
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, nickname, email, avatar_url')
            .limit(30);
          if (profiles) {
            setMembers(profiles.map((p: any) => ({
              id: p.id,
              name: p.nickname || p.name || '회원',
              email: p.email,
              avatarUrl: p.avatar_url,
              role: 'member'
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load mention candidates:', err);
      }
    };
    loadMembers();
  }, [communityId]);

  // Autocomplete Candidates filters
  const filteredMembers = members.filter(m => {
    const name = m.name || '';
    const email = m.email || '';
    const nickname = m.nickname || '';
    return name.toLowerCase().includes(searchState.query.toLowerCase()) || 
           email.toLowerCase().includes(searchState.query.toLowerCase()) ||
           nickname.toLowerCase().includes(searchState.query.toLowerCase());
  }).slice(0, 8);

  const POPULAR_HASHTAGS = ['공지사항', '질문', '자료공유', '출석체크', '도움요청', '잡담', '일일챌린지', '꿀팁', '업데이트', '건의사항'];
  const filteredHashtagsRaw = POPULAR_HASHTAGS.filter(tag => 
    tag.toLowerCase().includes(searchState.query.toLowerCase())
  );
  if (searchState.trigger === '#' && searchState.query && !filteredHashtagsRaw.includes(searchState.query)) {
    filteredHashtagsRaw.unshift(searchState.query);
  }
  const filteredHashtags = filteredHashtagsRaw.slice(0, 8);

  const filteredMembersRef = useRef(filteredMembers);
  filteredMembersRef.current = filteredMembers;

  const filteredHashtagsRef = useRef(filteredHashtags);
  filteredHashtagsRef.current = filteredHashtags;

  // Insert candidate callback
  const selectSuggestion = (index: number) => {
    const currentSearchState = searchStateRef.current;
    if (!editor || !currentSearchState.range) return;
    
    const { trigger, range } = currentSearchState;
    const { from, to } = range;
    
    if (trigger === '@') {
      const member = filteredMembersRef.current[index];
      if (!member) return;
      
      const label = member.name || member.nickname || '회원';
      
      editor.chain().focus()
        .deleteRange({ from, to })
        .insertContent({
          type: 'mention',
          attrs: { id: member.id, label }
        })
        .insertContent(' ')
        .run();
        
      toast.success(`${label}님을 소환했습니다.`);
    } else if (trigger === '#') {
      const tag = filteredHashtagsRef.current[index];
      if (!tag) return;
      
      // Selectively delete original hashtag search trigger text
      editor.chain().focus()
        .deleteRange({ from, to })
        .run();

      // Styled Hashtag element returning inline style & class configurations
      editor.chain().focus()
        .insertContent(`<span style="background-color: #6d28d9; color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 6px; display: inline-block; margin: 0 4px;" class="bg-purple-700 text-white font-extrabold px-1.5 py-0.5 rounded-md text-xs select-all mx-0.5 inline-block">#${tag}</span> `)
        .run();
        
      toast.success(`#${tag} 해시태그를 추가했습니다.`);
    }
    
    setSearchState({ isOpen: false, trigger: '', query: '', range: null });
  };

  const selectSuggestionRef = useRef(selectSuggestion);
  selectSuggestionRef.current = selectSuggestion;

  const handleEditorSelectionOrContentChange = ({ editor }: { editor: any }) => {
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - 20), $from.parentOffset, null, '\n');
    
    const lastWordMatch = textBefore.match(/([@#])([^\s]*)$/);
    if (lastWordMatch) {
      const trigger = lastWordMatch[1];
      const query = lastWordMatch[2];
      const from = $from.pos - lastWordMatch[0].length;
      const to = $from.pos;
      setSearchState({
        isOpen: true,
        trigger,
        query,
        range: { from, to }
      });
    } else {
      setSearchState({
        isOpen: false,
        trigger: '',
        query: '',
        range: null
      });
    }
  };

  const getCaretCoordinates = () => {
    if (!editor) return null;
    try {
      const { selection } = editor.state;
      const { $from } = selection;
      const coords = editor.view.coordsAtPos($from.pos);
      const editorEl = editor.view.dom.getBoundingClientRect();
      
      return {
        top: coords.bottom - editorEl.top + 24,
        left: Math.min(editorEl.width - 240, Math.max(16, coords.left - editorEl.left)),
      };
    } catch (e) {
      return null;
    }
  };

  const generateMetadata = (inputUrl: string): LinkPreview => {
    let domain = '알 수 없는 웹사이트';
    let title = '인터넷 외부 연결 링크';
    let description = '신뢰할 수 있고 안전한 외부 인터넷 연결 주소입니다.';
    let image = 'https://images.unsplash.com/photo-1481487196290-c152efe083f5?w=400&q=80';
    let siteName = '';

    try {
      const parsed = new URL(inputUrl);
      domain = parsed.hostname.replace('www.', '');
      siteName = domain.toUpperCase();
    } catch (e) {
      if (inputUrl) {
        domain = inputUrl.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
        siteName = domain.toUpperCase();
      }
    }

    const hostname = domain.toLowerCase();

    if (hostname.includes('github.com')) {
      title = 'GitHub - 전세계 개발자들의 협업 코드 정점 저장소';
      description = '소스코드의 공유, 버전 제어 및 협업을 위한 동급 최강의 SaaS 플랫폼. 전세계 개발 생태계의 중심 공간입니다.';
      image = 'https://images.unsplash.com/photo-1618401471353-b98aedd07871?w=400&q=80';
    } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      title = 'YouTube - 크리에이터 비디오 콘텐츠의 글로벌 허브';
      description = '일상 소통 영상 및 온라인 라이브 실시간 스트리밍 콘텐츠를 전세계 시청자들과 교감합니다.';
      image = 'https://images.unsplash.com/photo-1626379616459-b2ece1d936c5?w=400&q=80';
    } else if (hostname.includes('google.com') || hostname.includes('google.co.kr')) {
      title = 'Google 검색 - 전세계 지식 네트워크의 나침반';
      description = '웹 문서, 뉴스 정보 및 최신 자산을 정밀하게 질의하고 해석할 수 있는 세계 최고의 검색 라이브러리.';
      image = 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=400&q=80';
    } else if (hostname.includes('naver.com')) {
      title = 'NAVER 네이버 - 일상의 연결이자 대표 검색 포털';
      description = '지식iN, 카페, 블로그, 최신 주요 뉴스, 기상 정보와 실시간 스포츠 등 생활 편의를 원스톱 서비스합니다.';
      image = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&q=80';
    } else if (hostname.includes('notion.so') || hostname.includes('notion.site')) {
      title = 'Notion - 올인원 디지털 위키 포털이자 워크스페이스';
      description = '단일 작업창에서 계획 수집, 노트 작성, 프로젝트 로드맵 관리와 간이 데이터베이스 구축까지 한 번에 완료 가능합니다.';
      image = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400&q=80';
    } else if (hostname.includes('stackoverflow.com')) {
      title = 'Stack Overflow - 세계에서 가장 넓은 엔지니어 질답 지식인';
      description = '언어별 컴파일 오작동 교정, 프레임워크 인프라 설계 등을 동료 기술자들과 실시간 질답 해결합니다.';
      image = 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&q=80';
    } else {
      const displayDomain = siteName ? siteName : domain;
      title = `${displayDomain} - 도메인 공유 연결 링크`;
      description = `'${displayDomain}' 관련 유용한 온라인 학습 참고 공유 링크입니다. 안전하게 외부 연결 사이트로 이동하실 수 있습니다.`;
    }

    return {
      url: inputUrl,
      title,
      description,
      image
    };
  };

  const handleLinkPaste = (url: string) => {
    if (!url) return;
    let formattedUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      formattedUrl = `https://${url}`;
    }
    
    setLinkPreview({
      url: formattedUrl,
      title: '링크 메타 분석 중...',
      description: '웹페이지 도메인 정보를 바탕으로 가독성이 뛰어난 메타 정보를 수집 중입니다.'
    });

    try {
      setTimeout(() => {
        const meta = generateMetadata(formattedUrl);
        setLinkPreview(meta);
        toast.success('링크의 메타 정보가 수집되어 카드 블록으로 등록되었습니다.');
      }, 550);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkPasteRef = useRef(handleLinkPaste);
  handleLinkPasteRef.current = handleLinkPaste;

  const handlePastedFile = async (file: File) => {
    setIsUploading(true);
    try {
      let url = '';
      try {
        url = await communityService.uploadFile(file, `posts/${communityId || 'notices'}`);
      } catch (error) {
        console.error('File paste upload failed, falling back to base64', error);
        url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const mediaItem = { type: 'image' as const, url, name: file.name || 'clipboard-screenshot.png' };
      setMediaUrls(prev => [...prev, mediaItem]);
      
      if (editor) {
        editor.chain().focus().setImage({ src: url, alt: mediaItem.name }).run();
        toast.success('클립보드 스크린샷 이미지가 본문에 삽입되었습니다.');
      }
    } catch (e) {
      toast.error('클립보드 이미지 삽입 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePastedFileRef = useRef(handlePastedFile);
  handlePastedFileRef.current = handlePastedFile;

  const editor = useEditor({
    extensions,
    content: '',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm prose-slate max-w-none focus:outline-none min-h-[500px] p-8 text-slate-800 leading-normal font-sans select-text',
          'prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-headings:mt-2.5 prose-headings:mb-1',
          'prose-h1:text-xl prose-h1:font-extrabold',
          'prose-h2:text-lg prose-h2:font-bold',
          'prose-h3:text-base prose-h3:font-semibold',
          'prose-p:text-[13px] prose-p:leading-normal prose-p:text-slate-750 prose-p:my-1.5 prose-p:break-all',
          'prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-1.5 prose-blockquote:text-slate-500',
          'prose-code:text-red-500 prose-code:bg-slate-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs',
          'prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-md prose-pre:p-3 prose-pre:my-1.5 prose-pre:font-mono prose-pre:text-xs',
          'prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1.5',
          'prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-1.5',
          'prose-li:my-0.5 prose-li:text-slate-700',
          'prose-img:rounded-md prose-img:my-2 prose-img:max-w-full prose-img:h-auto prose-img:inline-block border border-slate-200 shadow-sm'
        ),
      },
      handleKeyDown: (view, event) => {
        const currentSearchState = searchStateRef.current;
        if (currentSearchState.isOpen) {
          const mCount = currentSearchState.trigger === '@' ? filteredMembersRef.current.length : filteredHashtagsRef.current.length;
          if (mCount > 0) {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelectedIndex(prev => (prev + 1) % mCount);
              return true;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelectedIndex(prev => (prev - 1 + mCount) % mCount);
              return true;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              selectSuggestionRef.current(selectedIndexRef.current);
              return true;
            }
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setSearchState({ isOpen: false, trigger: '', query: '', range: null });
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image/') !== -1) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                handlePastedFileRef.current(file);
                return true;
              }
            }
          }
        }
        
        const text = event.clipboardData?.getData('text/plain') || '';
        const urlRegex = /^(https?:\/\/[^\s]+)$/i;
        if (urlRegex.test(text.trim())) {
          handleLinkPasteRef.current(text.trim());
        }
        return false;
      }
    },
    onUpdate({ editor }) {
      handleEditorSelectionOrContentChange({ editor });
    },
    onSelectionUpdate({ editor }) {
      handleEditorSelectionOrContentChange({ editor });
    }
  });

  useEffect(() => {
    if (initialPost && editor) {
      setTitle(initialPost.title || '');
      
      // Parse content_json or use fallback
      let content = initialPost.content_json;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse content_json:', e);
          content = null;
        }
      }
      
      const finalContent = content || { text: initialPost.content, media: [], link: null, widget: null };
      
      // Load editor content
      if (finalContent.text) {
        if (typeof finalContent.text === 'object') {
          editor.commands.setContent(finalContent.text);
        } else {
          editor.commands.setContent(finalContent.text || '');
        }
      } else if (initialPost.content) {
        editor.commands.setContent(initialPost.content);
      }
      
      // Improved media loading logic: cross-reference all sources
      let mediaList: any[] = [];
      const seenUrls = new Set<string>();

      const addMedia = (m: any) => {
        if (m && m.url && !seenUrls.has(m.url)) {
          seenUrls.add(m.url);
          mediaList.push(m);
        }
      };

      // 1. From content_json.media
      if (Array.isArray(finalContent.media)) {
        finalContent.media.forEach(addMedia);
      }

      // 2. From image_urls and file_urls
      const parseUrls = (urls: any) => {
        if (!urls) return [];
        if (Array.isArray(urls)) return urls;
        if (typeof urls === 'string') {
          try {
            const parsed = JSON.parse(urls);
            return Array.isArray(parsed) ? parsed : [urls];
          } catch (e) {
            return urls.split(',').map((u: string) => u.trim()).filter(Boolean);
          }
        }
        return [];
      };

      parseUrls(initialPost.image_urls).forEach((url: string) => addMedia({ type: 'image', url }));
      parseUrls(initialPost.file_urls).forEach((url: string) => {
        const isImg = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        addMedia({ type: isImg ? 'image' : 'file', url });
      });
      
      setMediaUrls(mediaList);
      setLinkPreview(finalContent.link);
      
      if (finalContent.widget) {
        setActiveWidget(finalContent.widget.type);
        if (finalContent.widget.type === 'attendance') setAttendanceConfig(finalContent.widget.data);
        if (finalContent.widget.type === 'todo') setTodoConfig(finalContent.widget.data);
        if (finalContent.widget.type === 'poll') setPollConfig(finalContent.widget.data);
      }
    }
  }, [initialPost, editor]);

  // --- Handlers ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        const url = await communityService.uploadFile(file, `posts/${communityId || 'notices'}`);
        return { type, url, name: file.name };
      } catch (error: any) {
        console.error('File upload failed, falling back to base64', error);
        return new Promise<{ type: 'image' | 'video' | 'file', url: string, name: string }>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({ type, url: reader.result as string, name: file.name });
          };
          reader.readAsDataURL(file);
        });
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const validResults = results.filter((r): r is { type: 'image' | 'video' | 'file', url: string, name: string } => r !== null);
      
      setMediaUrls(prev => [...prev, ...validResults]);

      if (editor && validResults.length > 0) {
        validResults.forEach((res) => {
          if (res.type === 'image') {
            editor.chain().focus().setImage({ src: res.url, alt: res.name }).run();
          } else if (res.type === 'video') {
            editor.chain().focus().insertContent(`<video src="${res.url}" controls class="rounded-lg max-w-full my-4 border border-slate-200 bg-black h-auto block"></video>`).run();
          } else {
            editor.chain().focus().insertContent(`<p><a href="${res.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 font-extrabold hover:underline">📎 ${res.name || '파일 다운로드'}</a></p>`).run();
          }
        });
      }

      if (validResults.length > 0) {
        toast.success(`${validResults.length}개의 미디어가 본문에 삽입되었습니다.`);
      }
    } catch (error: any) {
      toast.error('업로드 과정에서 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleInsertLinkFromDialog = (url: string) => {
    if (!url) return;
    let formattedUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      formattedUrl = `https://${url}`;
    }
    if (editor) {
      editor.chain().focus().setLink({ href: formattedUrl }).run();
      toast.success('본문에 하이퍼링크가 추가되었습니다.');
      // Automatically extract metadata block!
      handleLinkPaste(formattedUrl);
    }
  };

  const handleSubmit = async () => {
    if (!editor || (!editor.getText() && mediaUrls.length === 0)) {
      return toast.error('내용을 입력해주세요.');
    }

    const content_json = {
      text: editor.getJSON(),
      html: editor.getHTML(),
      media: mediaUrls,
      link: linkPreview,
      widget: activeWidget ? {
        type: activeWidget,
        data: activeWidget === 'attendance' ? attendanceConfig :
              activeWidget === 'todo' ? todoConfig : pollConfig
      } : null,
      mission_id: initialPost?.content_json?.mission_id || initialPost?.mission_id || null
    };

    // Extract hashtags
    const text = editor.getText();
    const hashtags = text.match(/#[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+/g)?.map(t => t.slice(1)) || [];

    // Trigger developer custom onSubmit console or props if provided
    console.log('RichTextEditor Output:', {
      title: title || '새 게시글',
      html: editor.getHTML(),
      json: editor.getJSON()
    });

    if (onSubmit) {
      onSubmit({
        title: title || editor.getText().slice(0, 20) || '새 게시글',
        html: editor.getHTML(),
        json: editor.getJSON()
      });
      return;
    }

    try {
      const postData = {
        community_id: communityId || 'notices',
        title: title || editor.getText().slice(0, 20) || '새 게시글',
        content: editor.getHTML(),
        content_json,
        hashtags,
        type: (initialPost?.type || 'general') as any,
        image_urls: mediaUrls.filter(m => m.type === 'image').map(m => m.url),
        file_urls: mediaUrls.filter(m => m.type !== 'image').map(m => m.url),
        metadata: content_json.widget ? content_json.widget.data : null
      };

      const result = initialPost 
        ? await communityService.updatePost(initialPost.id, postData)
        : await communityService.createPost(postData);

      toast.success(initialPost ? '게시글이 수정되었습니다!' : '게시글이 등록되었습니다!');
      if (onSuccess) onSuccess(result);
      
      if (!initialPost) {
        editor.commands.clearContent();
        setTitle('');
        setMediaUrls([]);
        setLinkPreview(null);
        setActiveWidget(null);
      }
    } catch (error: any) {
      toast.error(error.message || '게시글 처리 실패');
    }
  };

  return (
    <Card className="w-full overflow-hidden border border-slate-200 bg-zinc-100 rounded-2xl shadow-xl flex flex-col">
      
      {/* 1. Gmail-Style Single Row Solid Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-2 z-10 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          
          {/* Undo / Redo */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="h-8 w-8 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded-md transition-colors"
            title="실행 취소 (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="h-8 w-8 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded-md transition-colors"
            title="다시 실행 (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </Button>

          <div className="w-[1px] h-4 bg-slate-300 mx-1" />

          {/* Heading Levels */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              "h-8 w-8 rounded-md text-xs font-black transition-all",
              editor?.isActive('heading', { level: 1 }) 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="제목 1"
          >
            H1
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              "h-8 w-8 rounded-md text-xs font-black transition-all",
              editor?.isActive('heading', { level: 2 }) 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="제목 2"
          >
            H2
          </Button>

          <div className="w-[1px] h-4 bg-slate-300 mx-1" />

          {/* Bold */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('bold') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="굵게 (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </Button>

          {/* Italic */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('italic') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="기울임 (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </Button>

          {/* Underline */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('underline') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="밑줄 (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </Button>

          {/* Strike */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('strike') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="취소선"
          >
            <Strikethrough className="w-4 h-4" />
          </Button>

          <div className="w-[1px] h-4 bg-slate-300 mx-1" />

          {/* Lists */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('bulletList') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="글머리 기호 목록"
          >
            <List className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('orderedList') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="번호 매기기 목록"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('blockquote') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="인용구"
          >
            <Quote className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            className={cn(
              "h-8 w-8 rounded-md transition-all",
              editor?.isActive('codeBlock') 
                ? "bg-slate-200 text-slate-900 border border-slate-300/40" 
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            title="코드 블록"
          >
            <Code2 className="w-4 h-4" />
          </Button>

          <div className="w-[1px] h-4 bg-slate-300 mx-1" />

          {/* Color Popover */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors",
                    editor?.isActive('textStyle') && "bg-slate-200 text-slate-950 font-bold border border-slate-300/45"
                  )}
                  title="글자 색상"
                >
                  <Palette className="w-4 h-4" />
                </Button>
              }
            />
            <PopoverContent className="w-48 p-2 rounded-xl border border-slate-200 bg-white shadow-xl" align="start">
              <div className="grid grid-cols-4 gap-1.5">
                {EDITOR_COLORS.map((col) => (
                  <button
                    key={col.color}
                    type="button"
                    onClick={() => {
                      if (col.color === '#1e293b') {
                        editor?.chain().focus().unsetColor().run();
                      } else {
                        editor?.chain().focus().setColor(col.color).run();
                      }
                    }}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer",
                      col.class,
                      editor?.isActive('textStyle', { color: col.color }) ? "ring-2 ring-purple-600 ring-offset-2 scale-105" : ""
                    )}
                    title={col.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-[1px] h-4 bg-slate-300 mx-1" />

          {/* Hyperlink Dialog */}
          <Dialog>
            <DialogTrigger 
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors",
                    editor?.isActive('link') && "bg-slate-200 text-slate-900"
                  )}
                  title="링크 추가"
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              }
            />
            <DialogContent className="rounded-2xl max-w-sm bg-white p-6 border border-slate-200 shadow-xl">
              <DialogHeader>
                <DialogTitle className="font-bold text-base text-slate-900">본문에 링크 주소 입력</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input 
                  ref={dialogLinkInputRef}
                  placeholder="예: https://naver.com" 
                  className="rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-600"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleInsertLinkFromDialog(e.currentTarget.value);
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button 
                  className="w-full rounded-lg bg-black hover:bg-zinc-800 text-white font-bold h-10"
                  onClick={() => handleInsertLinkFromDialog(dialogLinkInputRef.current?.value || '')}
                >
                  적용하기
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Action to Inline insert Image */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => imageUploadInputRef.current?.click()}
            className="h-8 w-8 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
            title="본문에 이미지 인라인 삽입"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <input 
            type="file" 
            ref={imageUploadInputRef} 
            onChange={(e) => handleFileUpload(e, 'image')} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
        
        {onCancel && (
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 text-gray-400 hover:text-gray-600 rounded-md">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 2. Paper-style document cards offset in standard workspace container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-zinc-100/90 flex flex-col justify-start items-center min-h-[580px]">
        <div className="w-full max-w-4xl bg-white rounded-lg shadow-sm border border-slate-250 overflow-hidden flex flex-col">
          
          {/* Subject / Title Row */}
          <div className="border-b border-slate-100 py-3 px-6 flex items-center bg-white shrink-0 select-none">
            <span className="text-slate-400 font-extrabold text-xs mr-3 uppercase tracking-wider shrink-0 select-none">제목:</span>
            <input
              type="text"
              placeholder="제목을 여기에 입력해 주세요..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-base font-bold text-slate-800 placeholder-slate-300 outline-none border-none focus:ring-0 p-0"
            />
          </div>

          {/* Actual RichText body Area */}
          <div className="relative flex-1 bg-white">
            <EditorContent editor={editor} />

            {/* Caret-aligned Floating Autocomplete Suggestion Dropdown */}
            {searchState.isOpen && (
              <div 
                className="absolute z-50 w-64 bg-white rounded-xl border border-slate-200 shadow-2xl p-1.5 flex flex-col gap-1 max-h-60 overflow-y-auto"
                style={{
                  top: getCaretCoordinates()?.top || 'auto',
                  left: getCaretCoordinates()?.left || 'auto',
                }}
              >
                {searchState.trigger === '@' ? (
                  <>
                    <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1 select-none flex items-center justify-between">
                      <span>멤버 소환하기</span>
                      <AtSign className="w-3 h-3 text-purple-400" />
                    </div>
                    {filteredMembers.length === 0 ? (
                      <div className="p-3 text-xs text-slate-450 font-bold text-center">맞는 멤버가 없습니다.</div>
                    ) : (
                      filteredMembers.map((member, idx) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => selectSuggestion(idx)}
                          className={cn(
                            "w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-none",
                            selectedIndex === idx ? "bg-purple-50 text-purple-700 font-extrabold ring-1 ring-purple-200/50" : "text-slate-705 hover:bg-slate-50"
                          )}
                        >
                          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[10px] text-purple-700 font-black shrink-0">
                            {member.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0 leading-tight">
                            <p className="truncate">{member.name}</p>
                            <span className="text-[9px] text-slate-400 font-medium truncate block">{member.email || '이메일 없음'}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1 select-none flex items-center justify-between">
                      <span>해시태그 입력</span>
                      <Hash className="w-3 h-3 text-purple-400" />
                    </div>
                    {filteredHashtags.length === 0 ? (
                      <div className="p-3 text-xs text-slate-450 font-bold text-center">태그 이름을 입력하세요...</div>
                    ) : (
                      filteredHashtags.map((tag, idx) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => selectSuggestion(idx)}
                          className={cn(
                            "w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-none",
                            selectedIndex === idx ? "bg-purple-700 text-white font-extrabold" : "text-slate-705 hover:bg-slate-50"
                          )}
                        >
                          <span className="text-purple-500 font-black font-mono">#</span>
                          <span className="truncate flex-1">{tag}</span>
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Live Post Attachments/Previews inside white document envelope */}
          <div className="px-6 pb-6 space-y-4">
            
            {/* Visual Grid of Attachments */}
            {mediaUrls.length > 0 && (
              <div className="border-t border-slate-100 pt-4 mt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 select-none">📎 등록된 첨부파일 ({mediaUrls.length}개)</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {mediaUrls.map((media, idx) => (
                    <div key={idx} className="relative aspect-[3/2] bg-slate-50 rounded-xl overflow-hidden border border-slate-205 group p-1 flex mt-1">
                      {media.type === 'image' ? (
                        <div className="w-full h-full relative">
                          <img src={media.url} alt="upload" className="w-full h-full object-cover rounded-lg" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                            <span className="text-[10px] text-white truncate font-medium max-w-full">{media.name || '이미지'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-lg p-2">
                          {media.type === 'video' ? <Video className="w-6 h-6 mb-1 text-red-500" /> : <FileText className="w-6 h-6 mb-1 text-blue-500" />}
                          <span className="text-[9px] text-slate-500 text-center truncate w-full font-bold">{media.name || '첨부 파일'}</span>
                        </div>
                      )}
                      <button 
                        type="button"
                        onClick={() => setMediaUrls(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors z-10 flex items-center justify-center"
                        title="첨부 해제"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link Preview box */}
            <AnimatePresence>
              {linkPreview && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex gap-4 mt-2"
                >
                  {linkPreview.image && (
                    <img src={linkPreview.image} alt="preview" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-900 truncate">{linkPreview.title}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{linkPreview.description}</p>
                    <span className="text-[10px] text-blue-500 mt-1 block truncate font-mono">{linkPreview.url}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setLinkPreview(null)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Smart Templates / Widget Previews */}
            <AnimatePresence>
              {activeWidget && (
                <motion.div
                  initial={{ opacity: 0, x: -25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 25 }}
                  className={cn(
                    "relative p-4 rounded-xl border-2 border-dashed flex flex-col gap-1.5 mt-2 transition-all",
                    activeWidget === 'attendance' ? "bg-orange-50/50 border-orange-200" :
                    activeWidget === 'todo' ? "bg-blue-50/50 border-blue-200" :
                    "bg-purple-50/50 border-purple-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {activeWidget === 'attendance' && <CalendarCheck className="w-5 h-5 text-orange-500" />}
                      {activeWidget === 'todo' && <ListTodo className="w-5 h-5 text-blue-500" />}
                      {activeWidget === 'poll' && <Vote className="w-5 h-5 text-purple-500" />}
                      <h4 className="text-xs font-bold text-slate-800">
                        {activeWidget === 'attendance' ? '출석체크 위젯 활성화' : 
                         activeWidget === 'todo' ? '할 일 체크리스트 활성화' : '투표 위젯 활성화'}
                      </h4>
                    </div>
                    <button type="button" onClick={() => setActiveWidget(null)} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {activeWidget === 'attendance' ? attendanceConfig.title :
                     activeWidget === 'todo' ? `${todoConfig.title} (항목 ${todoConfig.items.length}개 추가됨)` :
                     pollConfig.question || '피드백 질문을 설정해주세요.'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 3. Footer Control Bar (Gmail compose style bottom tray) */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4 shrink-0 z-10">
        <div className="flex items-center gap-1.5 flex-wrap">
          
          {/* Action triggers for upload */}
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => imageUploadInputRef.current?.click()} 
            className="text-slate-500 hover:text-purple-600 hover:bg-white rounded-md h-9 w-9"
            title="이미지 첨부"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => videoUploadInputRef.current?.click()} 
            className="text-slate-500 hover:text-red-500 hover:bg-white rounded-md h-9 w-9"
            title="동영상 첨부"
          >
            <Video className="w-5 h-5" />
          </Button>
          <input 
            type="file" 
            ref={videoUploadInputRef} 
            onChange={(e) => handleFileUpload(e, 'video')} 
            accept="video/*" 
            className="hidden" 
          />

          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => fileUploadInputRef.current?.click()} 
            className="text-slate-500 hover:text-emerald-600 hover:bg-white rounded-md h-9 w-9"
            title="파일 첨부"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <input 
            type="file" 
            ref={fileUploadInputRef} 
            onChange={(e) => handleFileUpload(e, 'file')} 
            className="hidden" 
            multiple
          />

          <div className="w-[1px] h-4 bg-slate-300 mx-1" />

          {/* Widgets Popover (Attendance/TodoList/Poll) */}
          <Popover>
            <PopoverTrigger 
               render={
                 <Button variant="ghost" size="icon" className="text-slate-500 hover:text-orange-500 hover:bg-white rounded-md h-9 w-9" title="위젯 추가">
                   <MoreHorizontal className="w-5 h-5" />
                 </Button>
               }
            />
            <PopoverContent className="w-56 p-2 rounded-xl shadow-xl bg-white border border-slate-200" align="start">
               <div className="grid grid-cols-1 gap-1">
                  <Button 
                    variant="ghost" 
                    className="justify-start gap-3 rounded-lg hover:bg-orange-50 text-slate-700 hover:text-orange-600"
                    onClick={() => setActiveWidget('attendance')}
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span className="text-xs font-bold">출석체크 위젯</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="justify-start gap-3 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-600"
                    onClick={() => setActiveWidget('todo')}
                  >
                    <ListTodo className="w-4 h-4" />
                    <span className="text-xs font-bold">체크리스트 (할 일)</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="justify-start gap-3 rounded-lg hover:bg-purple-50 text-slate-700 hover:text-purple-600"
                    onClick={() => setActiveWidget('poll')}
                  >
                    <Vote className="w-4 h-4" />
                    <span className="text-xs font-bold">설문/투표 위젯</span>
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger 
                      render={
                        <Button variant="ghost" className="justify-start gap-3 rounded-lg hover:bg-green-50 text-slate-700 hover:text-green-600">
                          <LinkIcon className="w-4 h-4" />
                          <span className="text-xs font-bold">링크 추가 (프리뷰)</span>
                        </Button>
                      }
                    />
                    <DialogContent className="rounded-2xl max-w-sm bg-white p-6 border border-slate-250">
                      <DialogHeader>
                        <DialogTitle className="font-bold text-base text-slate-900">링크 주소 입력</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Input 
                          ref={linkInputRef}
                          placeholder="https://..." 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleLinkPaste(e.currentTarget.value);
                            }
                          }}
                          className="rounded-lg border-slate-200"
                        />
                      </div>
                      <DialogFooter>
                        <Button 
                          className="w-full rounded-lg bg-black hover:bg-zinc-800 font-bold h-10"
                          onClick={() => handleLinkPaste(linkInputRef.current?.value || '')}
                        >
                          추가하기
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
               </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-yellow-500 hover:bg-white rounded-md h-9 w-9" title="이모지">
                  <Smile className="w-5 h-5" />
                </Button>
              }
            />
            <PopoverContent className="w-72 p-3 rounded-2xl border border-slate-200 bg-white shadow-xl max-h-72 overflow-y-auto" align="start">
              <div className="grid grid-cols-7 gap-1">
                {POPULAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      if (editor) {
                        editor.chain().focus().insertContent(emoji).run();
                      }
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-slate-100 transition-colors cursor-pointer border-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

        </div>

        {/* Action Button */}
        <Button 
          onClick={handleSubmit} 
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2.5 font-extrabold gap-2 transition-all shadow-md active:scale-95 text-xs select-none"
        >
          {isUploading ? '업로드 대기 중...' : (
            <>
              {submitButtonText || '게시글 작성 완료'}
              <Send className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      {/* Slide overlay for Widget configurations */}
      <AnimatePresence>
        {activeWidget === 'attendance' && (
          <WidgetModal 
            title="출석체크 설정" 
            onClose={() => setActiveWidget(null)}
            onSave={() => setActiveWidget('attendance')}
          >
            <div className="space-y-4">
               <div className="space-y-2">
                 <Label className="font-bold text-xs text-slate-700">위젯 제목</Label>
                 <Input 
                   value={attendanceConfig.title} 
                   onChange={(e) => setAttendanceConfig({ title: e.target.value })}
                   className="rounded-xl"
                 />
               </div>
            </div>
          </WidgetModal>
        )}

        {activeWidget === 'poll' && (
          <WidgetModal 
            title="투표 설정" 
            onClose={() => setActiveWidget(null)}
            onSave={() => setActiveWidget('poll')}
          >
            <div className="space-y-4">
               <div className="space-y-2">
                 <Label className="font-bold text-xs text-slate-750">질문 항목</Label>
                 <Input 
                   placeholder="피드백 받고 싶은 질문을 입력하세요." 
                   value={pollConfig.question}
                   onChange={(e) => setPollConfig(prev => ({ ...prev, question: e.target.value }))}
                   className="rounded-xl focus:ring-purple-600"
                 />
               </div>
               <div className="space-y-2">
                 <Label className="font-bold text-xs text-slate-700">선택지 입력</Label>
                 <div className="space-y-2">
                    {pollConfig.options.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input 
                          value={opt} 
                          onChange={(e) => {
                            const newOpts = [...pollConfig.options];
                            newOpts[idx] = e.target.value;
                            setPollConfig(prev => ({ ...prev, options: newOpts }));
                          }}
                          className="rounded-xl focus:ring-purple-600"
                          placeholder={`선택 항목 ${idx + 1}`}
                        />
                        {pollConfig.options.length > 2 && (
                          <Button variant="ghost" size="icon" onClick={() => {
                            setPollConfig(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
                          }}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button 
                      variant="ghost" 
                      onClick={() => setPollConfig(prev => ({ ...prev, options: [...prev.options, ''] }))}
                      className="w-full border border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-purple-600 h-10"
                    >
                      <Plus className="w-4 h-4 mr-2" /> 선택지 추가하기
                    </Button>
                 </div>
               </div>
            </div>
          </WidgetModal>
        )}

        {activeWidget === 'todo' && (
          <WidgetModal 
            title="할 일 목록 설정" 
            onClose={() => setActiveWidget(null)}
            onSave={() => setActiveWidget('todo')}
          >
            <div className="space-y-4">
               <div className="space-y-2">
                 <Label className="font-bold text-xs text-slate-750">체크리스트 위젯 제목</Label>
                 <Input 
                   value={todoConfig.title}
                   onChange={(e) => setTodoConfig(prev => ({ ...prev, title: e.target.value }))}
                   className="rounded-xl focus:ring-blue-500"
                 />
               </div>
               <div className="space-y-2">
                 <Label className="font-bold text-xs text-slate-700">과제 목록 추가</Label>
                 <div className="space-y-2">
                    {todoConfig.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input 
                          value={item} 
                          onChange={(e) => {
                            const newItems = [...todoConfig.items];
                            newItems[idx] = e.target.value;
                            setTodoConfig(prev => ({ ...prev, items: newItems }));
                          }}
                          className="rounded-xl focus:ring-blue-500"
                          placeholder={`내용을 입력하세요 ${idx + 1}`}
                        />
                        {todoConfig.items.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => {
                            setTodoConfig(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
                          }}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button 
                      variant="ghost" 
                      onClick={() => setTodoConfig(prev => ({ ...prev, items: [...prev.items, ''] }))}
                      className="w-full border border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-blue-500 h-10"
                    >
                      <Plus className="w-4 h-4 mr-2" /> 할 일 항목 추가하기
                    </Button>
                 </div>
               </div>
            </div>
          </WidgetModal>
        )}
      </AnimatePresence>
    </Card>
  );
}

// --- Helper Component ---
function WidgetModal({ title, children, onClose, onSave }: { title: string, children: React.ReactNode, onClose: () => void, onSave: () => void }) {
  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
       <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
         <h3 className="font-extrabold text-slate-900 text-sm">{title}</h3>
         <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-8 w-8 text-slate-500"><X className="w-4 h-4" /></Button>
       </div>
       <div className="flex-1 overflow-y-auto p-6 bg-white">
         {children}
       </div>
       <div className="p-4 border-t border-slate-200 bg-slate-50">
         <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-bold h-11 text-xs" onClick={onSave}>
           설정 완료 및 첨부하기
         </Button>
       </div>
    </div>
  );
}
