import React, { useEffect, useRef, useState } from 'react';
import { SkinViewer, WalkingAnimation, IdleAnimation } from 'skinview3d';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../context/NotificationContext';
import PageContent from '../components/layout/PageContent';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '../components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Separator } from '../components/ui/separator';
import { Plus, Trash2, Pencil, Pause, Play, X, AlertTriangle, Loader2, User, Crown, ImageUp, Link2, Download, Paintbrush, Eraser, Save, PaintBucket, Hand } from 'lucide-react';

const DEFAULT_SKINS = [
    { name: 'Steve', defaultModel: 'classic', urls: { classic: '/assets/skins/steve-classic.png', slim: '/assets/skins/steve-slim.png' } },
    { name: 'Alex', defaultModel: 'slim', urls: { classic: '/assets/skins/alex-classic.png', slim: '/assets/skins/alex-slim.png' } },
    { name: 'Ari', defaultModel: 'slim', urls: { classic: '/assets/skins/ari-classic.png', slim: '/assets/skins/ari-slim.png' } },
    { name: 'Efe', defaultModel: 'classic', urls: { classic: '/assets/skins/efe-classic.png', slim: '/assets/skins/efe-slim.png' } },
    { name: 'Kai', defaultModel: 'slim', urls: { classic: '/assets/skins/kai-classic.png', slim: '/assets/skins/kai-slim.png' } },
    { name: 'Makena', defaultModel: 'slim', urls: { classic: '/assets/skins/makena-classic.png', slim: '/assets/skins/makena-slim.png' } },
    { name: 'Noor', defaultModel: 'classic', urls: { classic: '/assets/skins/noor-classic.png', slim: '/assets/skins/noor-slim.png' } },
    { name: 'Sunny', defaultModel: 'classic', urls: { classic: '/assets/skins/sunny-classic.png', slim: '/assets/skins/sunny-slim.png' } },
    { name: 'Zuri', defaultModel: 'classic', urls: { classic: '/assets/skins/zuri-classic.png', slim: '/assets/skins/zuri-slim.png' } }
];

const getDefaultSkinUrl = (skin, model) => skin.urls[model === 'slim' ? 'slim' : 'classic'];

const SkinPreview3D = ({ src, className, model = 'classic' }: { src?: any; className?: string; model?: string }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const viewerRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !src) return;

        let viewer;
        try {
            viewer = new SkinViewer({
                canvas: canvasRef.current,
                width: 300,
                height: 400,
                skin: src
            });
            viewer.model = model?.toLowerCase() === 'slim' ? 'slim' : 'classic';
            viewer.zoom = 0.85;
            viewer.fov = 70;
            viewer.autoRotate = false;
            viewer.renderer.setPixelRatio(window.devicePixelRatio);

            viewer.playerObject.rotation.y = 0.5;

            viewerRef.current = viewer;

            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const { width, height } = entry.contentRect;
                    if (width > 0 && height > 0) {
                        viewer.setSize(width, height);
                    }
                }
            });

            if (containerRef.current) {
                resizeObserver.observe(containerRef.current);
            }

            return () => {
                resizeObserver.disconnect();
                if (viewer) viewer.dispose();
            };
        } catch (e) {
            console.error("Failed to render 3D preview", e);
        }
    }, [src, model]);

    return (
        <div ref={containerRef} className={`w-full h-full min-h-0 ${className}`}>
            <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
    );
};

const SkinPreview = ({ src, className, model = 'classic' }: { src?: any; className?: string; model?: string }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas || !src) return;
            const ctx = canvas.getContext('2d');
            const scale = 8;
            canvas.width = 16 * scale;
            canvas.height = 32 * scale;
            ctx.imageSmoothingEnabled = false;

            const img = new Image();
            img.src = src;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const isSlim = model === 'slim';
                const armWidth = isSlim ? 3 : 4;
                const drawPart = (sx, sy, sw, sh, dx, dy, dw, dh, shadow = false) => {
                    if (shadow) {
                        ctx.fillStyle = 'rgba(0,0,0,0.15)';
                        ctx.fillRect(dx * scale, (dy + 0.5) * scale, dw * scale, dh * scale);
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, dx * scale, dy * scale, dw * scale, dh * scale);
                };
                drawPart(4, 20, 4, 12, 4, 20, 4, 12);

                if (img.height === 64) drawPart(20, 52, 4, 12, 8, 20, 4, 12);
                else {
                    ctx.save();
                    ctx.scale(-1, 1);
                    drawPart(4, 20, 4, 12, -12, 20, 4, 12);
                    ctx.restore();
                }
                drawPart(20, 20, 8, 12, 4, 8, 8, 12);
                drawPart(44, 20, armWidth, 12, 4 - armWidth, 8, armWidth, 12);

                if (img.height === 64) drawPart(36, 52, armWidth, 12, 12, 8, armWidth, 12);
                else {
                    ctx.save();
                    ctx.scale(-1, 1);
                    drawPart(44, 20, 4, 12, -16, 8, 4, 12);
                    ctx.restore();
                }
                drawPart(8, 8, 8, 8, 4, 0, 8, 8, true);
                if (img.height === 64) {

                    drawPart(4, 36, 4, 12, 4, 20, 4, 12);
                    drawPart(4, 52, 4, 12, 8, 20, 4, 12);

                    drawPart(20, 36, 8, 12, 4, 8, 8, 12);

                    drawPart(44, 36, armWidth, 12, 4 - armWidth, 8, armWidth, 12);
                    drawPart(52, 52, armWidth, 12, 12, 8, armWidth, 12);
                }

                drawPart(40, 8, 8, 8, 4, 0, 8, 8);
            };
        };
        render();
    }, [src, model]);

    return <canvas ref={canvasRef} className={`w-full h-full object-contain image-pixelated ${className}`} />;
};

const CapePreview = ({ src, className }: { src?: any; className?: string }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas || !src) return;
            const ctx = canvas.getContext('2d');

            const scale = 8;
            canvas.width = 10 * scale;
            canvas.height = 16 * scale;
            ctx.imageSmoothingEnabled = false;

            const img = new Image();
            img.src = src;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const s = img.width / 64;
                ctx.drawImage(img, 1 * s, 1 * s, 10 * s, 16 * s, 0, 0, 10 * scale, 16 * scale);
            };
        };
        render();
    }, [src]);

    return <canvas ref={canvasRef} className={`w-full h-full object-contain image-pixelated ${className}`} />;
};

const AdvancedSkinEditorDialog = ({
    open,
    onOpenChange,
    skinSrc,
    model,
    onSave,
    onNotify,
    t
}) => {
    const viewerCanvasRef = useRef(null);
    const viewerContainerRef = useRef(null);
    const textureLargeCanvasRef = useRef(null);
    const textureCanvasRef = useRef(null);
    const viewerRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerVectorRef = useRef(new THREE.Vector2());
    const pointerDownRef = useRef(false);
    const strokeActiveRef = useRef(false);
    const meshesRef = useRef<any[]>([]);
    const syncScheduledRef = useRef(false);
    const lastPointerRef = useRef({ x: -1, y: -1 });
    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef(-1);
    const toolRef = useRef<'paint' | 'erase' | 'fill'>('paint');
    const brushColorRef = useRef('#ff6600');
    const brushSizeRef = useRef(1);
    const mirrorModeRef = useRef<'none' | 'x' | 'y' | 'xy'>('none');
    const activeLargeViewRef = useRef<'player' | 'texture'>('player');
    const dragModeRef = useRef(false);

    const [editorModel, setEditorModel] = useState(model || 'classic');
    const [brushColor, setBrushColor] = useState('#ff6600');
    const [brushSize, setBrushSize] = useState(1);
    const [tool, setTool] = useState<'paint' | 'erase' | 'fill'>('paint');
    const [mirrorMode, setMirrorMode] = useState<'none' | 'x' | 'y' | 'xy'>('none');
    const [activeLargeView, setActiveLargeView] = useState<'player' | 'texture'>('player');
    const [dragMode, setDragMode] = useState(false);
    const [pose, setPose] = useState('t_pose');
    const [flatPreview, setFlatPreview] = useState('');
    const [skinName, setSkinName] = useState('Edited Skin');
    const [isSaving, setIsSaving] = useState(false);
    const [, setHistoryVersion] = useState(0);

    useEffect(() => {
        if (!open) return;
        setEditorModel(model || 'classic');
        setActiveLargeView('player');
        setPose('t_pose');
        setDragMode(false);
    }, [model, open]);

    useEffect(() => {
        toolRef.current = tool;
    }, [tool]);

    useEffect(() => {
        brushColorRef.current = brushColor;
    }, [brushColor]);

    useEffect(() => {
        brushSizeRef.current = brushSize;
    }, [brushSize]);

    useEffect(() => {
        mirrorModeRef.current = mirrorMode;
    }, [mirrorMode]);

    useEffect(() => {
        activeLargeViewRef.current = activeLargeView;
    }, [activeLargeView]);

    useEffect(() => {
        dragModeRef.current = dragMode;
        if (dragMode) {
            pointerDownRef.current = false;
            strokeActiveRef.current = false;
            lastPointerRef.current = { x: -1, y: -1 };
        }
        if (viewerRef.current?.controls) {
            viewerRef.current.controls.enableRotate = dragMode;
        }
    }, [dragMode]);

    const cloneImageData = (imageData) => {
        return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    };

    const updateHistoryState = () => {
        setHistoryVersion(prev => prev + 1);
    };

    const resetHistory = () => {
        const textureCanvas = textureCanvasRef.current;
        if (!textureCanvas) return;
        const ctx = textureCanvas.getContext('2d');
        const snapshot = cloneImageData(ctx.getImageData(0, 0, textureCanvas.width, textureCanvas.height));
        historyRef.current = [snapshot];
        historyIndexRef.current = 0;
        updateHistoryState();
    };

    const pushHistorySnapshot = () => {
        const textureCanvas = textureCanvasRef.current;
        if (!textureCanvas) return;
        const ctx = textureCanvas.getContext('2d');
        const snapshot = cloneImageData(ctx.getImageData(0, 0, textureCanvas.width, textureCanvas.height));
        const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        nextHistory.push(snapshot);
        if (nextHistory.length > 80) {
            nextHistory.shift();
        }
        historyRef.current = nextHistory;
        historyIndexRef.current = nextHistory.length - 1;
        updateHistoryState();
    };

    const renderTextureLargeCanvas = () => {
        const source = textureCanvasRef.current;
        const target = textureLargeCanvasRef.current;
        if (!source || !target) return;
        const rect = target.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        if (target.width !== width || target.height !== height) {
            target.width = width;
            target.height = height;
        }
        const ctx = target.getContext('2d');
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(source, 0, 0, target.width, target.height);
    };

    const applyPose = () => {
        const viewer = viewerRef.current;
        if (!viewer?.playerObject?.skin) return;
        const skin = viewer.playerObject.skin;
        const body = skin.body;
        const head = skin.head;
        const leftArm = skin.leftArm;
        const rightArm = skin.rightArm;
        const leftLeg = skin.leftLeg;
        const rightLeg = skin.rightLeg;

        [body, head, leftArm, rightArm, leftLeg, rightLeg].forEach((part) => {
            if (!part) return;
            part.rotation.x = 0;
            part.rotation.y = 0;
            part.rotation.z = 0;
        });

        if (!leftArm || !rightArm || !leftLeg || !rightLeg || !body || !head) return;

        switch (pose) {
            case 'idle':
                rightArm.rotation.x = -0.12;
                leftArm.rotation.x = 0.1;
                rightLeg.rotation.x = 0.06;
                leftLeg.rotation.x = -0.06;
                break;
            case 'wave':
                rightArm.rotation.x = -1.35;
                rightArm.rotation.z = -0.2;
                leftArm.rotation.x = 0.15;
                head.rotation.y = -0.15;
                break;
            case 'hero':
                rightArm.rotation.x = -2.2;
                leftArm.rotation.x = -0.2;
                rightLeg.rotation.x = 0.1;
                leftLeg.rotation.x = -0.05;
                head.rotation.y = 0.12;
                break;
            case 'sneak':
                body.rotation.x = 0.5;
                head.rotation.x = -0.5;
                rightArm.rotation.x = 0.25;
                leftArm.rotation.x = 0.25;
                rightLeg.rotation.x = -0.45;
                leftLeg.rotation.x = -0.45;
                break;
            case 'cross':
                rightArm.rotation.z = -1.2;
                leftArm.rotation.z = 1.2;
                rightArm.rotation.x = -0.2;
                leftArm.rotation.x = -0.2;
                break;
            case 't_pose':
            default:
                rightArm.rotation.z = -Math.PI / 2;
                leftArm.rotation.z = Math.PI / 2;
                break;
        }
    };

    const getMirroredPoints = (x, y, width, height) => {
        const base = [{ x, y }];
        const mirroredX = width - 1 - x;
        const mirroredY = height - 1 - y;

        if (mirrorModeRef.current === 'x' || mirrorModeRef.current === 'xy') {
            base.push({ x: mirroredX, y });
        }
        if (mirrorModeRef.current === 'y' || mirrorModeRef.current === 'xy') {
            base.push({ x, y: mirroredY });
        }
        if (mirrorModeRef.current === 'xy') {
            base.push({ x: mirroredX, y: mirroredY });
        }

        const unique = new Map();
        base.forEach(point => {
            const key = `${point.x}:${point.y}`;
            if (!unique.has(key)) unique.set(key, point);
        });

        return Array.from(unique.values());
    };

    const parseColorToRgba = (hex) => {
        const safeHex = `${hex || '#000000'}`.replace('#', '');
        const r = parseInt(safeHex.slice(0, 2), 16) || 0;
        const g = parseInt(safeHex.slice(2, 4), 16) || 0;
        const b = parseInt(safeHex.slice(4, 6), 16) || 0;
        return [r, g, b, 255];
    };

    const paintAtPixel = (pixelX, pixelY) => {
        const textureCanvas = textureCanvasRef.current;
        if (!textureCanvas) return;
        const ctx = textureCanvas.getContext('2d');
        const points = getMirroredPoints(pixelX, pixelY, textureCanvas.width, textureCanvas.height);

        points.forEach((point) => {
            const halfSize = Math.floor(brushSizeRef.current / 2);
            const startX = Math.max(0, point.x - halfSize);
            const startY = Math.max(0, point.y - halfSize);
            const drawSize = Math.max(1, brushSizeRef.current);

            if (toolRef.current === 'erase') {
                ctx.clearRect(startX, startY, drawSize, drawSize);
            } else {
                ctx.fillStyle = brushColorRef.current;
                ctx.fillRect(startX, startY, drawSize, drawSize);
            }
        });

        scheduleSkinSync();
    };

    const fillFromPixel = (seedX, seedY) => {
        const textureCanvas = textureCanvasRef.current;
        if (!textureCanvas) return;
        const ctx = textureCanvas.getContext('2d');

        const seeds = getMirroredPoints(seedX, seedY, textureCanvas.width, textureCanvas.height);
        const replacement = toolRef.current === 'erase' ? [0, 0, 0, 0] : parseColorToRgba(brushColorRef.current);

        const applyFill = (sx, sy) => {
            const imageData = ctx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
            const { data, width, height } = imageData;
            const startIndex = (sy * width + sx) * 4;
            const target = [
                data[startIndex],
                data[startIndex + 1],
                data[startIndex + 2],
                data[startIndex + 3]
            ];

            if (
                target[0] === replacement[0] &&
                target[1] === replacement[1] &&
                target[2] === replacement[2] &&
                target[3] === replacement[3]
            ) {
                return;
            }

            const stack = [[sx, sy]];
            const matchAt = (index) => (
                data[index] === target[0] &&
                data[index + 1] === target[1] &&
                data[index + 2] === target[2] &&
                data[index + 3] === target[3]
            );

            while (stack.length) {
                const [x, y] = stack.pop();
                if (x < 0 || y < 0 || x >= width || y >= height) continue;

                const idx = (y * width + x) * 4;
                if (!matchAt(idx)) continue;

                data[idx] = replacement[0];
                data[idx + 1] = replacement[1];
                data[idx + 2] = replacement[2];
                data[idx + 3] = replacement[3];

                stack.push([x + 1, y]);
                stack.push([x - 1, y]);
                stack.push([x, y + 1]);
                stack.push([x, y - 1]);
            }

            ctx.putImageData(imageData, 0, 0);
        };

        seeds.forEach(({ x, y }) => applyFill(x, y));
        scheduleSkinSync();
    };

    const getTexturePixelFromEvent = (event) => {
        const textureCanvas = textureCanvasRef.current;
        const textureLargeCanvas = textureLargeCanvasRef.current;
        if (!textureCanvas || !textureLargeCanvas) return null;
        const rect = textureLargeCanvas.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return null;

        const px = Math.max(0, Math.min(textureCanvas.width - 1, Math.floor((localX / rect.width) * textureCanvas.width)));
        const py = Math.max(0, Math.min(textureCanvas.height - 1, Math.floor((localY / rect.height) * textureCanvas.height)));
        return { px, py };
    };

    const syncViewerSkin = async () => {
        if (!viewerRef.current || !textureCanvasRef.current) return;
        const dataUrl = textureCanvasRef.current.toDataURL('image/png');
        setFlatPreview(dataUrl);
        await viewerRef.current.loadSkin(dataUrl, { model: editorModel === 'slim' ? 'slim' : 'classic' });
        ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"].forEach(part => {
            if (viewerRef.current.playerObject.skin[part]) {
                viewerRef.current.playerObject.skin[part].innerLayer.visible = true;
                viewerRef.current.playerObject.skin[part].outerLayer.visible = true;
            }
        });

        const meshes = [];
        viewerRef.current.playerObject.traverse(obj => {
            if (obj?.isMesh && obj?.material?.map && obj?.geometry) {
                meshes.push(obj);
            }
        });
        meshesRef.current = meshes;
        applyPose();
        renderTextureLargeCanvas();
    };

    const scheduleSkinSync = () => {
        if (syncScheduledRef.current) return;
        syncScheduledRef.current = true;
        requestAnimationFrame(async () => {
            syncScheduledRef.current = false;
            await syncViewerSkin();
        });
    };

    useEffect(() => {
        if (!open || !skinSrc || !textureCanvasRef.current) return;

        let cancelled = false;
        const isRemoteHttp = /^https?:\/\//i.test(skinSrc);

        const drawSkinToCanvas = (src, useCorsForHttp) => {
            return new Promise<void>((resolve, reject) => {
                const img = new Image();
                if (useCorsForHttp && /^https?:\/\//i.test(src)) {
                    img.crossOrigin = 'anonymous';
                }

                img.onload = () => {
                    if (cancelled) {
                        resolve();
                        return;
                    }

                    const canvas = textureCanvasRef.current;
                    if (!canvas) {
                        resolve();
                        return;
                    }

                    try {
                        const ctx = canvas.getContext('2d');
                        canvas.width = 64;
                        canvas.height = img.height === 32 ? 32 : 64;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resetHistory();
                        scheduleSkinSync();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };

                img.onerror = (event) => {
                    console.error('Failed to load skin texture in advanced editor', { src, event });
                    reject(new Error('skin-image-load-failed'));
                };

                img.src = src;
            });
        };

        const loadTexture = async () => {
            try {
                await drawSkinToCanvas(skinSrc, true);
            } catch (primaryError) {
                if (!isRemoteHttp || !window.electronAPI?.saveLocalSkin || cancelled) {
                    console.error('Failed to load skin texture in advanced editor', { skinSrc, primaryError });
                    if (!cancelled) {
                        onNotify(t('skins.import_failed', { error: 'Editor preview load failed' }), 'error');
                    }
                    return;
                }

                try {
                    const fallback = await window.electronAPI.saveLocalSkin({
                        source: 'url',
                        value: skinSrc,
                        name: 'Remote Skin',
                        model: editorModel
                    });

                    if (!fallback?.success || !fallback?.skin?.data) {
                        throw new Error(fallback?.error || 'No fallback skin data');
                    }

                    await drawSkinToCanvas(fallback.skin.data, false);
                } catch (fallbackError) {
                    console.error('Failed to load skin texture with fallback data', {
                        skinSrc,
                        primaryError,
                        fallbackError
                    });
                    if (!cancelled) {
                        onNotify(t('skins.import_failed', { error: 'Editor preview load failed' }), 'error');
                    }
                }
            }
        };

        loadTexture();

        return () => {
            cancelled = true;
        };
    }, [open, skinSrc, editorModel]);

    useEffect(() => {
        if (!open || !viewerCanvasRef.current) return;

        if (viewerRef.current) {
            try {
                const staleRenderer = viewerRef.current.renderer;
                viewerRef.current.dispose();
                staleRenderer?.dispose?.();
                staleRenderer?.forceContextLoss?.();
            } catch (error) {
                console.warn('Failed to dispose stale advanced skin viewer', error);
            } finally {
                viewerRef.current = null;
            }
        }

        const viewer = new SkinViewer({
            canvas: viewerCanvasRef.current,
            width: 680,
            height: 520,
            skin: null
        });

        viewer.fov = 70;
        viewer.zoom = 0.9;
        viewer.autoRotate = false;
        viewer.animation = null;
        viewer.renderer.setPixelRatio(window.devicePixelRatio);
        viewer.controls.enablePan = false;
        viewer.controls.enableRotate = dragModeRef.current;

        viewerRef.current = viewer;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    viewer.setSize(width, height);
                }
            }
        });

        if (viewerContainerRef.current) {
            resizeObserver.observe(viewerContainerRef.current);
        }

        const paintFromViewerEvent = (event) => {
            const textureCanvas = textureCanvasRef.current;
            if (!textureCanvas || !viewerRef.current) return;

            const rect = viewer.renderer.domElement.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            pointerVectorRef.current.set(x, y);
            raycasterRef.current.setFromCamera(pointerVectorRef.current, viewer.camera);
            const intersections = raycasterRef.current.intersectObjects(meshesRef.current, false);
            if (!intersections.length || !intersections[0].uv) return;

            const uv = intersections[0].uv;
            const pixelX = Math.max(0, Math.min(textureCanvas.width - 1, Math.floor(uv.x * textureCanvas.width)));
            const pixelY = Math.max(0, Math.min(textureCanvas.height - 1, Math.floor((1 - uv.y) * textureCanvas.height)));

            if (lastPointerRef.current.x === pixelX && lastPointerRef.current.y === pixelY) {
                return;
            }
            lastPointerRef.current = { x: pixelX, y: pixelY };

            if (toolRef.current === 'fill') {
                fillFromPixel(pixelX, pixelY);
            } else {
                paintAtPixel(pixelX, pixelY);
            }
        };

        const paintFromTextureEvent = (event) => {
            const pixel = getTexturePixelFromEvent(event);
            if (!pixel) return;
            if (lastPointerRef.current.x === pixel.px && lastPointerRef.current.y === pixel.py) return;
            lastPointerRef.current = { x: pixel.px, y: pixel.py };

            if (toolRef.current === 'fill') {
                fillFromPixel(pixel.px, pixel.py);
            } else {
                paintAtPixel(pixel.px, pixel.py);
            }
        };

        const beginStroke = () => {
            if (strokeActiveRef.current) return;
            strokeActiveRef.current = true;
            pushHistorySnapshot();
        };

        const endStroke = () => {
            strokeActiveRef.current = false;
            pointerDownRef.current = false;
            lastPointerRef.current = { x: -1, y: -1 };
        };

        const handlePointerDown = (event) => {
            if (dragModeRef.current) {
                return;
            }
            pointerDownRef.current = true;
            lastPointerRef.current = { x: -1, y: -1 };
            beginStroke();
            if (activeLargeViewRef.current === 'player') {
                paintFromViewerEvent(event);
            } else {
                paintFromTextureEvent(event);
            }
        };

        const handlePointerMove = (event) => {
            if (!pointerDownRef.current) return;
            if (activeLargeViewRef.current === 'player') {
                paintFromViewerEvent(event);
            } else {
                paintFromTextureEvent(event);
            }
        };

        const handlePointerUp = () => endStroke();

        const viewerDomElement = viewer.renderer.domElement;

        viewerDomElement.addEventListener('pointerdown', handlePointerDown);
        viewerDomElement.addEventListener('pointermove', handlePointerMove);
        textureLargeCanvasRef.current?.addEventListener('pointerdown', handlePointerDown);
        textureLargeCanvasRef.current?.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        const resizeObserverTexture = new ResizeObserver(() => renderTextureLargeCanvas());
        if (textureLargeCanvasRef.current?.parentElement) {
            resizeObserverTexture.observe(textureLargeCanvasRef.current.parentElement);
        }

        scheduleSkinSync();

        return () => {
            viewerDomElement.removeEventListener('pointerdown', handlePointerDown);
            viewerDomElement.removeEventListener('pointermove', handlePointerMove);
            textureLargeCanvasRef.current?.removeEventListener('pointerdown', handlePointerDown);
            textureLargeCanvasRef.current?.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            resizeObserver.disconnect();
            resizeObserverTexture.disconnect();
            const renderer = viewer.renderer;
            viewer.dispose();
            renderer?.dispose?.();
            renderer?.forceContextLoss?.();
            viewerRef.current = null;
            pointerDownRef.current = false;
            strokeActiveRef.current = false;
            meshesRef.current = [];
        };
    }, [open]);

    useEffect(() => {
        if (!open || !viewerRef.current) return;
        scheduleSkinSync();
    }, [editorModel, open, pose]);

    const handleUndo = () => {
        if (historyIndexRef.current <= 0 || !textureCanvasRef.current) return;
        historyIndexRef.current -= 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        const ctx = textureCanvasRef.current.getContext('2d');
        ctx.putImageData(cloneImageData(snapshot), 0, 0);
        updateHistoryState();
        scheduleSkinSync();
    };

    const handleRedo = () => {
        if (historyIndexRef.current >= historyRef.current.length - 1 || !textureCanvasRef.current) return;
        historyIndexRef.current += 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        const ctx = textureCanvasRef.current.getContext('2d');
        ctx.putImageData(cloneImageData(snapshot), 0, 0);
        updateHistoryState();
        scheduleSkinSync();
    };

    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    const handleSave = async () => {
        if (!textureCanvasRef.current) return;

        try {
            setIsSaving(true);
            const res = await window.electronAPI.saveLocalSkin({
                source: 'data-url',
                value: textureCanvasRef.current.toDataURL('image/png'),
                name: skinName,
                model: editorModel
            });

            if (res.success && res.skin) {
                onSave(res.skin, editorModel);
                onOpenChange(false);
            } else if (res.error && res.error !== 'Cancelled') {
                onNotify(t('skins.import_failed', { error: res.error }), 'error');
            }
        } catch (e) {
            onNotify(t('skins.import_failed', { error: e.message }), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl">
                <DialogHeader>
                    <DialogTitle>{t('skins.advanced_editor')}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-8 space-y-3">
                        <div className="rounded-lg border border-border bg-muted/20 h-[520px] relative" ref={viewerContainerRef}>
                            <canvas
                                ref={viewerCanvasRef}
                                className={`w-full h-full ${activeLargeView === 'player' ? `${dragMode ? 'cursor-grab' : 'cursor-crosshair'} opacity-100` : 'opacity-0 pointer-events-none absolute inset-0'}`}
                            />
                            <canvas
                                ref={textureLargeCanvasRef}
                                className={`w-full h-full image-pixelated ${activeLargeView === 'texture' ? `${dragMode ? 'cursor-not-allowed' : 'cursor-crosshair'} opacity-100` : 'opacity-0 pointer-events-none absolute inset-0'}`}
                            />
                        </div>

                        <div className="rounded-lg border border-border p-2 bg-muted/10">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                                {t('skins.swap_large_view')}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveLargeView('player')}
                                    className={`rounded border p-2 text-left ${activeLargeView === 'player' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                                >
                                    <div className="text-xs font-medium">{t('skins.player_view')}</div>
                                    <div className="text-[11px] text-muted-foreground">{t('skins.click_to_activate')}</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveLargeView('texture')}
                                    className={`rounded border p-2 text-left ${activeLargeView === 'texture' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                                >
                                    <div className="text-xs font-medium">{t('skins.texture_view')}</div>
                                    {flatPreview ? (
                                        <img src={flatPreview} alt="texture preview" className="w-full h-16 object-contain image-pixelated mt-1 rounded bg-muted/30" />
                                    ) : (
                                        <div className="text-[11px] text-muted-foreground">{t('common.loading')}</div>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-4">
                        <div className="space-y-2">
                            <Label>{t('skins.skin_name')}</Label>
                            <Input value={skinName} onChange={(e) => setSkinName(e.target.value)} maxLength={60} />
                        </div>

                        <div className="space-y-2">
                            <Label>{t('skins.model')}</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={editorModel === 'classic' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setEditorModel('classic')}
                                    className="flex-1"
                                >
                                    {t('skins.wide')}
                                </Button>
                                <Button
                                    type="button"
                                    variant={editorModel === 'slim' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setEditorModel('slim')}
                                    className="flex-1"
                                >
                                    {t('skins.slim')}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('skins.pose')}</Label>
                            <select
                                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                                value={pose}
                                onChange={(e) => setPose(e.target.value)}
                            >
                                <option value="t_pose">{t('skins.pose_t_pose')}</option>
                                <option value="idle">{t('skins.pose_idle')}</option>
                                <option value="wave">{t('skins.pose_wave')}</option>
                                <option value="hero">{t('skins.pose_hero')}</option>
                                <option value="sneak">{t('skins.pose_sneak')}</option>
                                <option value="cross">{t('skins.pose_cross')}</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('skins.tool')}</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    type="button"
                                    variant={tool === 'paint' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTool('paint')}
                                    className="flex-1"
                                >
                                    <Paintbrush className="h-4 w-4" />
                                    {t('skins.paint')}
                                </Button>
                                <Button
                                    type="button"
                                    variant={tool === 'erase' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTool('erase')}
                                    className="flex-1"
                                >
                                    <Eraser className="h-4 w-4" />
                                    {t('skins.erase')}
                                </Button>
                                <Button
                                    type="button"
                                    variant={tool === 'fill' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTool('fill')}
                                    className="flex-1"
                                >
                                    <PaintBucket className="h-4 w-4" />
                                    {t('skins.fill')}
                                </Button>
                            </div>
                            <Button
                                type="button"
                                variant={dragMode ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setDragMode(prev => !prev)}
                                className="w-full"
                            >
                                <Hand className="h-4 w-4" />
                                {t('skins.drag_mode', 'Drag mode')}
                            </Button>
                            {dragMode && (
                                <div className="text-xs text-muted-foreground">
                                    {t('skins.drag_mode_hint', 'Drag mode active: painting is disabled.')}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>{t('skins.mirror_mode')}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" variant={mirrorMode === 'none' ? 'default' : 'outline'} size="sm" onClick={() => setMirrorMode('none')}>
                                    {t('skins.mirror_none')}
                                </Button>
                                <Button type="button" variant={mirrorMode === 'x' ? 'default' : 'outline'} size="sm" onClick={() => setMirrorMode('x')}>
                                    {t('skins.mirror_left_right')}
                                </Button>
                                <Button type="button" variant={mirrorMode === 'y' ? 'default' : 'outline'} size="sm" onClick={() => setMirrorMode('y')}>
                                    {t('skins.mirror_top_bottom')}
                                </Button>
                                <Button type="button" variant={mirrorMode === 'xy' ? 'default' : 'outline'} size="sm" onClick={() => setMirrorMode('xy')}>
                                    {t('skins.mirror_both')}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('skins.color')}</Label>
                            <Input
                                type="color"
                                value={brushColor}
                                disabled={tool === 'erase'}
                                onChange={(e) => setBrushColor(e.target.value)}
                                className="h-10 p-1"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{t('skins.brush_size')}</Label>
                            <Input
                                type="range"
                                min={1}
                                max={6}
                                step={1}
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                disabled={tool === 'fill'}
                            />
                            <div className="text-xs text-muted-foreground">
                                {tool === 'fill' ? t('skins.fill_brush_note') : `${brushSize}px`}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('skins.history')}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}>
                                    {t('skins.undo')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo}>
                                    {t('skins.redo')}
                                </Button>
                            </div>
                        </div>

                        <div className="rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                            {t('skins.advanced_hint')}
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {t('common.save')}
                            </Button>
                        </div>
                    </div>
                </div>

                <canvas ref={textureCanvasRef} className="hidden" />
            </DialogContent>
        </Dialog>
    );
};

function Skins({ onLogout, onProfileUpdate }) {
    const { t } = useTranslation();
    const { addNotification } = useNotification();
    const canvasRef = useRef(null);
    const skinViewerRef = useRef(null);
    const [currentSkinUrl, setCurrentSkinUrl] = useState(null);
    const [localSkins, setLocalSkins] = useState([]);
    const [pendingSkin, setPendingSkin] = useState(null);

    const [variant, setVariant] = useState('classic');
    const [isAnimating, setIsAnimating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSkinLoaded, setIsSkinLoaded] = useState(false);

    const [editingSkinId, setEditingSkinId] = useState(null);
    const [editName, setEditName] = useState('');

    const [userProfile, setUserProfile] = useState(null);

    const [capes, setCapes] = useState([]);
    const [activeCapeId, setActiveCapeId] = useState(null);
    const [originalVariant, setOriginalVariant] = useState('classic');
    const [showCapeModal, setShowCapeModal] = useState(false);
    const [showAddSkinModal, setShowAddSkinModal] = useState(false);
    const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
    const [addSkinSource, setAddSkinSource] = useState('file');
    const [skinUrlInput, setSkinUrlInput] = useState('');
    const [skinUsernameInput, setSkinUsernameInput] = useState('');
    const [isImportingSkin, setIsImportingSkin] = useState(false);
    const [webglError, setWebglError] = useState(false);

    const isWebGLSupported = () => {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    };

    useEffect(() => {
        if (!canvasRef.current) return;

        if (!isWebGLSupported()) {
            console.error("WebGL is not supported or context could not be created.");
            setWebglError(true);
            return;
        }

        let viewer;
        try {
            viewer = new SkinViewer({
                canvas: canvasRef.current,
                width: 300,
                height: 400,
                skin: null
            });

            viewer.fov = 70;
            viewer.zoom = 0.9;
            viewer.animation = new IdleAnimation();
            viewer.autoRotate = false;
            viewer.autoRotateSpeed = 0.5;
            if (canvasRef.current) {
                canvasRef.current.style.imageRendering = "pixelated";
            }
            viewer.renderer.setPixelRatio(window.devicePixelRatio);

            skinViewerRef.current = viewer;
            viewer.controls.enableZoom = false;
            viewer.controls.minPolarAngle = Math.PI / 2;
            viewer.controls.maxPolarAngle = Math.PI / 2;
            if (viewer.controls.setAzimuthalAngle) {
                viewer.controls.setAzimuthalAngle(0.5);
                viewer.controls.update();
            }

            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const { width, height } = entry.contentRect;
                    if (width > 0 && height > 0) {
                        viewer.setSize(width, height);
                    }
                }
            });

            const container = canvasRef.current.parentElement;
            if (container) {
                resizeObserver.observe(container);
            }

            return () => {
                resizeObserver.disconnect();
                if (viewer) {
                    viewer.dispose();
                }
            };
        } catch (e) {
            console.error("Failed to initialize SkinViewer:", e);
            setWebglError(true);
        }
    }, []);
    useEffect(() => {
        loadProfileAndSkin();
        loadLocalSkins();

        window.electronAPI.getSettings().then(res => {
            if (res.success) {
                if (res.settings.focusMode) setIsAnimating(false);
                if (res.settings.lowGraphicsMode) setWebglError(true);
            }
        });
    }, []);
    useEffect(() => {
    }, []);
    useEffect(() => {
        if (skinViewerRef.current) {
            skinViewerRef.current.animation = isAnimating ? new WalkingAnimation() : new IdleAnimation();
        }
    }, [isAnimating]);

    const updateSkinInViewer = async (url, model) => {
        if (!skinViewerRef.current) return;
        try {
            await skinViewerRef.current.loadSkin(url, { model: model?.toLowerCase() || 'classic' });
            ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"].forEach(part => {
                if (skinViewerRef.current.playerObject.skin[part]) {
                    skinViewerRef.current.playerObject.skin[part].innerLayer.visible = true;
                    skinViewerRef.current.playerObject.skin[part].outerLayer.visible = true;
                }
            });
            const activeCape = capes.find(c => c.id === activeCapeId);
            if (activeCape) skinViewerRef.current.loadCape(activeCape.url);

            setIsSkinLoaded(true);
        } catch (e) {
            console.error("Failed to update skin viewer", e);
        }
    }

    const getPendingPreviewUrl = (model = variant) => {
        if (pendingSkin?.type === 'default') {
            return getDefaultSkinUrl(pendingSkin, model);
        }
        return pendingSkin?.url || pendingSkin?.data || currentSkinUrl;
    };

    const loadProfileAndSkin = async () => {
        setIsLoading(true);
        try {
            if (!window.electronAPI?.getProfile) return;
            if (window.electronAPI.validateSession) {
                const val = await window.electronAPI.validateSession();
                if (!val.success) {
                    if (onLogout) onLogout();
                    else setUserProfile(null);
                    setIsLoading(false);
                    return;
                }
            }

            const profile = await window.electronAPI.getProfile();
            if (profile && profile.access_token && window.electronAPI.getCurrentSkin) {
                try {
                    const res = await window.electronAPI.getCurrentSkin(profile.access_token);
                    if (res.success) {
                        const skinUrl = res.url;
                        const model = (res.variant || 'classic').toLowerCase();

                        profile.skinUrl = skinUrl;
                        setCurrentSkinUrl(skinUrl);
                        setVariant(model);
                        setOriginalVariant(model);
                        setCapes(res.capes || []);

                        const activeCape = (res.capes || []).find(c => c.state === 'ACTIVE');
                        setActiveCapeId(activeCape ? activeCape.id : null);

                        await updateSkinInViewer(skinUrl, model);
                    } else {
                        if (res.authError) {
                            addNotification(t('login.failed') + '. ' + t('common.restart_app'), 'error');
                            if (onLogout) onLogout();
                            return;
                        }
                        addNotification(t('skins.upload_failed', { error: res.error }), 'info');
                        setIsSkinLoaded(true);
                    }
                } catch (e) {
                    console.error("Failed to load skin", e);
                    addNotification(t('skins.upload_failed', { error: 'Mojang' }), 'error');
                }
            }

            setUserProfile(profile);
            if (onProfileUpdate) onProfileUpdate(profile);
        } catch (e) {
            console.error("Failed to load profile/skin", e);
            addNotification(t('skins.upload_failed', { error: t('common.error_title') }), 'error');
        }
        setIsLoading(false);
    };

    const loadLocalSkins = async () => {
        try {
            if (!window.electronAPI?.getLocalSkins) return;
            const skins = await window.electronAPI.getLocalSkins();
            setLocalSkins(skins || []);
        } catch (e) {
            console.error("Failed to load local skins", e);
        }
    };

    const resetAddSkinForm = () => {
        setAddSkinSource('file');
        setSkinUrlInput('');
        setSkinUsernameInput('');
        setIsImportingSkin(false);
    };

    const handleAddSkinModalChange = (open) => {
        setShowAddSkinModal(open);
        if (!open) {
            resetAddSkinForm();
        }
    };

    const handleImportResult = async (res) => {
        if (res.success) {
            addNotification(t('skins.import_success'), 'success');
            await loadLocalSkins();

            if (res.skin) {
                setPendingSkin({ type: 'local', ...res.skin });
                const nextVariant = res.skin.model || variant;
                if (res.skin.model) {
                    setVariant(res.skin.model);
                }
                if (res.skin.data) {
                    await updateSkinInViewer(res.skin.data, nextVariant);
                }
            }

            handleAddSkinModalChange(false);
        } else if (res.error !== 'Cancelled') {
            addNotification(t('skins.import_failed', { error: res.error }), 'error');
        }
    };

    const handleImportSkinFromFile = async () => {
        if (!window.electronAPI?.saveLocalSkin) return;
        try {
            setIsImportingSkin(true);
            const res = await window.electronAPI.saveLocalSkin();
            await handleImportResult(res);
        } catch (e) {
            console.error("Import failed", e);
        } finally {
            setIsImportingSkin(false);
        }
    };

    const handleImportSkinFromUrl = async () => {
        if (!window.electronAPI?.saveLocalSkinFromUrl || !skinUrlInput.trim()) return;
        try {
            setIsImportingSkin(true);
            const res = await window.electronAPI.saveLocalSkinFromUrl(skinUrlInput.trim());
            await handleImportResult(res);
        } catch (e) {
            console.error("Import from URL failed", e);
            addNotification(t('skins.import_failed', { error: e.message }), 'error');
        } finally {
            setIsImportingSkin(false);
        }
    };

    const handleImportSkinFromUsername = async () => {
        if (!window.electronAPI?.saveLocalSkinFromUsername || !skinUsernameInput.trim()) return;
        try {
            setIsImportingSkin(true);
            const res = await window.electronAPI.saveLocalSkinFromUsername(skinUsernameInput.trim());
            await handleImportResult(res);
        } catch (e) {
            console.error("Import from username failed", e);
            addNotification(t('skins.import_failed', { error: e.message }), 'error');
        } finally {
            setIsImportingSkin(false);
        }
    };

    const handleSelectLocalSkin = async (skin) => {
        setPendingSkin({ type: 'local', ...skin });
        const nextVariant = skin.model || variant;
        if (skin.model) {
            setVariant(skin.model);
        }
        if (skin.data) {
            await updateSkinInViewer(skin.data, nextVariant);
        }
    };

    const handleSelectDefaultSkin = async (skin) => {
        setPendingSkin({ type: 'default', ...skin });
        setVariant(skin.defaultModel);

        await updateSkinInViewer(getDefaultSkinUrl(skin, skin.defaultModel), skin.defaultModel);
    };

    const handleApplySkin = async () => {
        if (!pendingSkin && variant === originalVariant) return;
        if (!userProfile) {
            addNotification(t('skins.upload_failed', { error: 'Auth' }), 'error');
            return;
        }

        setIsLoading(true);
        let res;

        try {
            if (pendingSkin) {
                if (pendingSkin.type === 'local') {
                    res = await window.electronAPI.uploadSkin(userProfile.access_token, pendingSkin.path, variant);
                } else if (pendingSkin.type === 'url') {
                    res = await window.electronAPI.uploadSkinFromUrl(userProfile.access_token, pendingSkin.url, variant);
                } else if (pendingSkin.type === 'default') {
                    res = await window.electronAPI.uploadSkinFromUrl(userProfile.access_token, getDefaultSkinUrl(pendingSkin, variant), variant);
                }
            } else if (variant !== originalVariant && currentSkinUrl) {
                res = await window.electronAPI.uploadSkinFromUrl(userProfile.access_token, currentSkinUrl, variant);
            }

            if (res.success) {
                addNotification(t('skins.upload_success'), 'success');
                setPendingSkin(null);

                loadProfileAndSkin();
            } else {
                addNotification(t('skins.upload_failed', { error: res.error }), 'error');
            }
        } catch (e) {
            console.error(e);
            addNotification(t('skins.upload_failed', { error: e.message }), 'error');
        }

        setIsLoading(false);
    };

    const handleSetCape = async (capeId) => {
        if (!userProfile) return;
        setIsLoading(true);
        const res = await window.electronAPI.setCape(userProfile.access_token, capeId);
        setIsLoading(false);

        if (res.success) {
            const cape = capes.find(c => c.id === capeId);
            setActiveCapeId(capeId);
            if (skinViewerRef.current) {
                skinViewerRef.current.loadCape(cape ? cape.url : null);
            }
            setShowCapeModal(false);
            addNotification(capeId ? t('skins.cape_activated') : t('skins.cape_removed'), 'success');
        } else {
            addNotification(t('skins.upload_failed', { error: res.error }), 'error');
        }
    };

    const handleDownloadSkin = async (skin) => {
        const res = await window.electronAPI.exportLocalSkin(skin.id);
        if (res.success) {
            addNotification(t('skins.download_success'), 'success');
        } else {
            addNotification(t('skins.download_failed', { error: res.error }), 'error');
        }
    };

    const handleDeleteSkin = async (id) => {
        const res = await window.electronAPI.deleteLocalSkin(id);
        if (res.success) {
            addNotification(t('skins.delete_success'), 'info');
            if (pendingSkin?.id === id) {
                setPendingSkin(null);

                if (skinViewerRef.current && currentSkinUrl) {
                    await updateSkinInViewer(currentSkinUrl, variant);
                }
            }
            loadLocalSkins();
        } else {
            addNotification(t('skins.delete_failed', { error: res.error }), 'error');
        }
    };

    const handleRename = async (id) => {
        if (!editName.trim()) {
            setEditingSkinId(null);
            return;
        }
        const res = await window.electronAPI.renameLocalSkin(id, editName);
        if (res.success) {
            addNotification(t('skins.rename_success'), 'success');
            loadLocalSkins();
        } else {
            addNotification(t('skins.rename_failed', { error: res.error }), 'error');
        }
        setEditingSkinId(null);
    };

    const handleSaveAdvancedSkin = async (skin, nextModel) => {
        setPendingSkin({ type: 'local', ...skin });
        const resolvedModel = nextModel || skin.model || variant;
        setVariant(resolvedModel);
        if (skin.data) {
            await updateSkinInViewer(skin.data, resolvedModel);
        }
        await loadLocalSkins();
        addNotification(t('skins.advanced_saved'), 'success');
    };

    return (
        <TooltipProvider>
            <div className="h-full flex overflow-hidden relative">
                <Dialog open={showCapeModal} onOpenChange={setShowCapeModal}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{t('skins.select_cape')}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                            <div
                                onClick={() => handleSetCape(null)}
                                className={`aspect-[3/4] rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${activeCapeId === null ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50 bg-muted/50'}`}
                            >
                                <X className="h-6 w-6 text-muted-foreground mb-2" />
                                <span className="text-sm font-medium text-muted-foreground">{t('skins.no_cape')}</span>
                            </div>

                            {capes.map(cape => (
                                <div
                                    key={cape.id}
                                    onClick={() => handleSetCape(cape.id)}
                                    className={`aspect-[3/4] rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden ${activeCapeId === cape.id ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50 bg-muted/50'}`}
                                >
                                    <div className="h-1/2 w-full p-2 flex items-center justify-center">
                                        <CapePreview src={cape.url} />
                                    </div>
                                    <span className="text-sm font-medium text-foreground text-center px-2">{cape.alias}</span>
                                    {activeCapeId === cape.id && (
                                        <Badge className="absolute top-2 right-2" variant="default">
                                            {t('skins.active')}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
                <Dialog open={showAddSkinModal} onOpenChange={handleAddSkinModalChange}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{t('skins.add_skin')}</DialogTitle>
                        </DialogHeader>
                        <Tabs value={addSkinSource} onValueChange={setAddSkinSource} className="space-y-4">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="file">{t('skins.source_file')}</TabsTrigger>
                                <TabsTrigger value="url">{t('skins.source_url')}</TabsTrigger>
                                <TabsTrigger value="username">{t('skins.source_username')}</TabsTrigger>
                            </TabsList>

                            <TabsContent value="file" className="mt-0 space-y-4">
                                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                                    {t('skins.source_file_desc')}
                                </div>
                                <Button onClick={handleImportSkinFromFile} disabled={isImportingSkin} className="w-full">
                                    {isImportingSkin ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                                    {t('skins.choose_skin_file')}
                                </Button>
                            </TabsContent>

                            <TabsContent value="url" className="mt-0 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="skin-url-input">{t('skins.skin_url_label')}</Label>
                                    <Input
                                        id="skin-url-input"
                                        value={skinUrlInput}
                                        onChange={(e) => setSkinUrlInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleImportSkinFromUrl();
                                            }
                                        }}
                                        placeholder={t('skins.skin_url_placeholder')}
                                        disabled={isImportingSkin}
                                    />
                                </div>
                                <Button onClick={handleImportSkinFromUrl} disabled={isImportingSkin || !skinUrlInput.trim()} className="w-full">
                                    {isImportingSkin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                    {t('skins.import_from_url')}
                                </Button>
                            </TabsContent>

                            <TabsContent value="username" className="mt-0 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="skin-username-input">{t('skins.username_label')}</Label>
                                    <Input
                                        id="skin-username-input"
                                        value={skinUsernameInput}
                                        onChange={(e) => setSkinUsernameInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleImportSkinFromUsername();
                                            }
                                        }}
                                        placeholder={t('skins.username_placeholder')}
                                        disabled={isImportingSkin}
                                    />
                                </div>
                                <Button onClick={handleImportSkinFromUsername} disabled={isImportingSkin || !skinUsernameInput.trim()} className="w-full">
                                    {isImportingSkin ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                                    {t('skins.fetch_from_username')}
                                </Button>
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>

                <AdvancedSkinEditorDialog
                    open={showAdvancedEditor}
                    onOpenChange={setShowAdvancedEditor}
                    skinSrc={getPendingPreviewUrl()}
                    model={variant}
                    onSave={handleSaveAdvancedSkin}
                    onNotify={addNotification}
                    t={t}
                />

                <div className="w-1/3 min-w-[300px] bg-card/50 backdrop-blur-sm border-r border-border flex flex-col items-center justify-center relative p-6">
                    <div className={`relative w-full h-[400px] flex items-center justify-center transition-opacity duration-300 ${isSkinLoaded || webglError ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="pointer-events-none absolute left-1/2 -top-7 z-10 -translate-x-1/2">
                            <div
                                className="px-3 py-1 text-center text-white"
                                style={{
                                    fontFamily: "'Minecraft', monospace",
                                    fontSize: '24px',
                                    lineHeight: 1,
                                    imageRendering: 'pixelated',
                                    backgroundColor: 'rgba(0, 0, 0, 0.32)'
                                }}
                            >
                                {userProfile?.name || t('skins.guest')}
                            </div>
                        </div>
                        {webglError ? (
                            <div className="flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-12 h-12 bg-destructive/15 text-destructive rounded-xl flex items-center justify-center mb-4">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground mb-1">{t('common.error_title')}</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    {t('skins.webgl_error') || "3D Preview is not available on your system. You can still manage your skins using the 2D previews below."}
                                </p>
                            </div>
                        ) : (
                            <canvas ref={canvasRef} className="cursor-move outline-none" />
                        )}
                    </div>

                    {!isSkinLoaded && !webglError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        </div>
                    )}

                    <div className="absolute bottom-6 flex items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsAnimating(!isAnimating)}
                                >
                                    {isAnimating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isAnimating ? t('skins.pause') : t('skins.play')}
                            </TooltipContent>
                        </Tooltip>

                        <Separator orientation="vertical" className="h-6" />

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                const newVariant = variant === 'classic' ? 'slim' : 'classic';
                                setVariant(newVariant);

                                const url = getPendingPreviewUrl(newVariant);
                                if (skinViewerRef.current && url) {
                                    updateSkinInViewer(url, newVariant);
                                }
                            }}
                        >
                            <User className="h-4 w-4" />
                            {t('skins.model')}: {variant === 'classic' ? `(${t('skins.wide')})` : `(${t('skins.slim')})`}
                        </Button>

                        <Separator orientation="vertical" className="h-6" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowCapeModal(true)}
                                    disabled={!capes.length}
                                >
                                    <Crown className="h-4 w-4" />
                                    {capes.length ? t('skins.change_cape') : t('skins.no_capes')}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {capes.length ? t('skins.change_cape') : t('skins.no_capes')}
                            </TooltipContent>
                        </Tooltip>

                        <Separator orientation="vertical" className="h-6" />

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (!getPendingPreviewUrl()) {
                                    addNotification(t('skins.select_skin_first'), 'info');
                                    return;
                                }
                                setShowAdvancedEditor(true);
                            }}
                        >
                            <Paintbrush className="h-4 w-4" />
                            {t('skins.advanced')}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-foreground tracking-tight">{t('skins.title')}</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">{t('skins.desc')}</p>
                        </div>
                        {(pendingSkin || (variant !== originalVariant && currentSkinUrl)) && (
                            <Button
                                onClick={handleApplySkin}
                                disabled={isLoading}
                                size="sm"
                            >
                                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isLoading ? t('skins.uploading') : t('skins.apply')}
                            </Button>
                        )}
                    </div>

                    <PageContent>
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('skins.saved_skins')}</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                <div
                                    onClick={() => handleAddSkinModalChange(true)}
                                    className="aspect-[3/4] bg-muted/50 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2 group-hover:bg-primary/15 transition-colors">
                                        <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{t('skins.add_skin')}</span>
                                </div>

                                {localSkins.map((skin) => (
                                    <ContextMenu key={skin.id}>
                                        <ContextMenuTrigger>
                                            <div
                                                onClick={() => handleSelectLocalSkin(skin)}
                                                className={`aspect-[3/4] bg-card rounded-lg overflow-hidden relative cursor-pointer border-2 transition-all group ${pendingSkin?.id === skin.id ? 'border-primary ring-1 ring-primary/25' : 'border-transparent hover:border-border'}`}
                                            >
                                                <div className="p-3 flex items-center justify-center h-full bg-muted/30">
                                                    {!webglError ? (
                                                        <SkinPreview3D src={skin.data || `file://${skin.path}`} />
                                                    ) : (
                                                        <SkinPreview src={skin.data || `file://${skin.path}`} />
                                                    )}
                                                </div>
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center gap-1">
                                                        {editingSkinId === skin.id ? (
                                                            <Input
                                                                autoFocus
                                                                className="h-6 text-xs px-1.5 bg-background/80 border-primary"
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleRename(skin.id);
                                                                    if (e.key === 'Escape') setEditingSkinId(null);
                                                                }}
                                                                onBlur={() => handleRename(skin.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        ) : (
                                                            <>
                                                                <span
                                                                    className="text-foreground text-xs font-medium truncate flex-1 cursor-text"
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingSkinId(skin.id);
                                                                        setEditName(skin.name);
                                                                    }}
                                                                >
                                                                    {skin.name}
                                                                </span>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5 shrink-0"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingSkinId(skin.id);
                                                                                setEditName(skin.name);
                                                                            }}
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Rename</TooltipContent>
                                                                </Tooltip>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteSkin(skin.id);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="w-48">
                                            <ContextMenuItem onClick={() => handleDownloadSkin(skin)}>
                                                <Download className="h-4 w-4" />
                                                {t('skins.download_skin')}
                                            </ContextMenuItem>
                                            <ContextMenuItem onClick={() => handleDeleteSkin(skin.id)} className="text-destructive focus:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                                {t('common.delete')}
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    </ContextMenu>
                                ))}
                            </div>
                        </div>

                        <Separator className="my-5" />

                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('skins.default_skins')}</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {DEFAULT_SKINS.map(skin => (
                                    <div
                                        key={skin.name}
                                        onClick={() => handleSelectDefaultSkin(skin)}
                                        className={`aspect-[3/4] bg-card rounded-lg overflow-hidden relative cursor-pointer border-2 transition-all group ${pendingSkin?.name === skin.name ? 'border-primary ring-1 ring-primary/25' : 'border-transparent hover:border-border'}`}
                                    >
                                        <div className="p-3 flex items-center justify-center h-full bg-muted/30">
                                            {!webglError ? (
                                                <SkinPreview3D src={getDefaultSkinUrl(skin, skin.defaultModel)} model={skin.defaultModel} />
                                            ) : (
                                                <SkinPreview src={getDefaultSkinUrl(skin, skin.defaultModel)} model={skin.defaultModel} />
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-foreground text-xs font-medium truncate">
                                                {skin.name}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PageContent>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default Skins;
