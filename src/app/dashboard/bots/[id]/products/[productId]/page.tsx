import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { BotNav } from '@/components/dashboard/bot-nav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { ArrowLeft, Save, Star, Check } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';

export const metadata: Metadata = { title: 'Edit Product', robots: { index: false } };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; productId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireAuth();
  const { id, productId } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const product = await db.product.findFirst({
    where: { id: productId, botId: id },
    include: {
      productMedia: {
        orderBy: { sortOrder: 'asc' },
        include: { media: { select: { id: true, filename: true, type: true } } },
      },
    },
  });
  if (!product) notFound();

  // Media library for selection
  const mediaLibrary = await db.media.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, filename: true, type: true, fileSize: true, mimeType: true },
  });

  // Set of currently associated media IDs
  const associatedMediaIds = new Set(product.productMedia.map(pm => pm.mediaId));
  const primaryMediaId = product.productMedia.find(pm => pm.isPrimary)?.mediaId || null;

  async function handleUpdateProduct(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const existingProduct = await db.product.findFirst({ where: { id: productId, botId: id } });
    if (!existingProduct) redirect(`/dashboard/bots/${id}/products`);

    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      redirect(`/dashboard/bots/${id}/products/${productId}?error=${encodeURIComponent('Product name is required')}`);
    }

    const description = (formData.get('description') as string)?.trim();
    if (!description) {
      redirect(`/dashboard/bots/${id}/products/${productId}?error=${encodeURIComponent('Description is required')}`);
    }

    const advantages = (formData.get('advantages') as string)?.trim();
    if (!advantages) {
      redirect(`/dashboard/bots/${id}/products/${productId}?error=${encodeURIComponent('Advantages are required')}`);
    }

    const targetAudience = (formData.get('targetAudience') as string)?.trim();
    if (!targetAudience) {
      redirect(`/dashboard/bots/${id}/products/${productId}?error=${encodeURIComponent('Target audience is required')}`);
    }

    const buyingReasons = (formData.get('buyingReasons') as string)?.trim();
    if (!buyingReasons) {
      redirect(`/dashboard/bots/${id}/products/${productId}?error=${encodeURIComponent('Buying reasons are required')}`);
    }

    const brand = (formData.get('brand') as string)?.trim() || null;
    const category = (formData.get('category') as string)?.trim() || null;
    const price = (formData.get('price') as string)?.trim() || null;
    const url = (formData.get('url') as string)?.trim() || null;
    const aiInstructions = (formData.get('aiInstructions') as string)?.trim() || null;
    const keywordsRaw = (formData.get('keywords') as string)?.trim() || '';
    const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : [];

    // Media selections
    const selectedMedia = formData.getAll('media') as string[];
    const newPrimaryMediaId = (formData.get('primaryMedia') as string) || null;

    // Validate media ownership
    if (selectedMedia.length > 0) {
      const mediaCount = await db.media.count({
        where: { id: { in: selectedMedia }, botId: id },
      });
      if (mediaCount !== selectedMedia.length) {
        redirect(`/dashboard/bots/${id}/products/${productId}?error=${encodeURIComponent('Some selected media not found')}`);
      }
    }

    // Update product + re-create media associations in a transaction
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          name,
          description,
          brand,
          category,
          price,
          url,
          advantages,
          targetAudience,
          buyingReasons,
          aiInstructions,
          keywords,
        },
      });

      // Delete old associations and recreate
      await tx.productMedia.deleteMany({ where: { productId } });
      if (selectedMedia.length > 0) {
        await tx.productMedia.createMany({
          data: selectedMedia.map((mediaId, index) => ({
            productId,
            mediaId,
            sortOrder: index,
            isPrimary: mediaId === newPrimaryMediaId || (index === 0 && !newPrimaryMediaId),
          })),
        });
      }
    });

    redirect(`/dashboard/bots/${id}/products/${productId}?success=${encodeURIComponent('Product updated')}`);
  }

  const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const textareaClass = 'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Edit Product</h1>
        <p className="text-sm text-muted-foreground mt-1">Update product information for AI promotion.</p>
        <BotNav botId={id} activeTab="products" />
      </div>

      {sp.success && <AlertMessage type="success" message={sp.success} />}
      {sp.error && <AlertMessage type="error" message={sp.error} />}

      <Link href={`/dashboard/bots/${id}/products`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </Link>

      <form action={handleUpdateProduct} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core details about your product or service.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Product Name <span className="text-destructive">*</span>
                </label>
                <input name="name" type="text" required defaultValue={product.name} className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Brand</label>
                <input name="brand" type="text" defaultValue={product.brand || ''} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <input name="category" type="text" defaultValue={product.category || ''} className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price</label>
                <input name="price" type="text" defaultValue={product.price || ''} className={inputClass} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Product URL</label>
              <input name="url" type="url" defaultValue={product.url || ''} className={inputClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
                <HelpTip text="Detailed description of what the product/service is." />
              </label>
              <textarea name="description" required defaultValue={product.description} className={textareaClass} />
            </div>
          </CardContent>
        </Card>

        {/* Marketing Info */}
        <Card>
          <CardHeader>
            <CardTitle>Marketing Information</CardTitle>
            <CardDescription>Help AI understand how to promote this product effectively.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Key Advantages &amp; Benefits <span className="text-destructive">*</span>
                <HelpTip text="USPs, benefits, and advantages." />
              </label>
              <textarea name="advantages" required defaultValue={product.advantages} className={textareaClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Target Audience <span className="text-destructive">*</span>
                <HelpTip text="Who buys this product. Demographics, interests, pain points." />
              </label>
              <textarea name="targetAudience" required defaultValue={product.targetAudience} className={textareaClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Why People Should Buy <span className="text-destructive">*</span>
                <HelpTip text="Compelling reasons to choose your product." />
              </label>
              <textarea name="buyingReasons" required defaultValue={product.buyingReasons} className={textareaClass} />
            </div>
          </CardContent>
        </Card>

        {/* AI Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>AI Presentation</CardTitle>
            <CardDescription>Tell AI how to promote this product on social media.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                AI Instructions
                <HelpTip text="How AI should present this product. Tone, style, phrases to use or avoid." />
              </label>
              <textarea name="aiInstructions" defaultValue={product.aiInstructions || ''} className={textareaClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Keywords / Tags</label>
              <input name="keywords" type="text" defaultValue={product.keywords.join(', ')} className={inputClass} />
              <p className="text-xs text-muted-foreground">Separate with commas.</p>
            </div>
          </CardContent>
        </Card>

        {/* Media */}
        <Card>
          <CardHeader>
            <CardTitle>Product Media</CardTitle>
            <CardDescription>Choose images and videos from your media library. The AI uses these when creating promotional posts for this product.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Explanation cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="font-medium text-sm">Primary Image</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The main product photo used as <strong>thumbnail</strong> in the product selector and post form.
                  Claude AI Vision analyzes this image to understand your product visually and generate better promotional content.
                  Select <strong>one</strong> image as primary.
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Check className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Additional Media</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Extra photos and videos available when creating posts for this product.
                  Select <strong>multiple</strong> for variety — images, videos, any format.
                  These will be suggested as attachments in the Post Scheduler when this product is selected.
                </p>
              </div>
            </div>

            {mediaLibrary.length === 0 ? (
              <div className="text-center py-8 border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground mb-2">No media uploaded yet.</p>
                <Link href={`/dashboard/bots/${id}/media`} className="text-sm text-primary underline">
                  Go to Media Library to upload images and videos
                </Link>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Click to select media. Then mark one as <Star className="h-3 w-3 inline text-amber-500 fill-amber-500 -mt-0.5" /> <strong>Primary</strong>.
                  You can select as many additional media as you want.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto p-1">
                  {mediaLibrary.map((m) => {
                    const sizeMB = m.fileSize ? (m.fileSize / (1024 * 1024)).toFixed(1) : null;
                    return (
                      <label key={m.id} className="relative cursor-pointer">
                        <input type="checkbox" name="media" value={m.id} defaultChecked={associatedMediaIds.has(m.id)} className="peer sr-only" />
                        {/* Card container */}
                        <div className="rounded-lg border-2 border-muted peer-checked:border-primary peer-checked:shadow-md overflow-hidden bg-muted/30 transition-all hover:shadow-sm">
                          {/* Thumbnail */}
                          <div className="h-28 w-full relative">
                            {m.type === 'VIDEO' ? (
                              <>
                                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                <video src={`/api/media/${m.id}`} className="h-full w-full object-cover" muted preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <div className="h-7 w-7 rounded-full bg-black/50 flex items-center justify-center">
                                    <svg className="h-3.5 w-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                                </div>
                              </>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`/api/media/${m.id}`} alt={m.filename} className="h-full w-full object-cover" />
                            )}
                            {/* Type badge */}
                            <span className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${m.type === 'VIDEO' ? 'bg-purple-600/80' : 'bg-emerald-600/80'}`}>
                              {m.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'}
                            </span>
                          </div>
                          {/* Info */}
                          <div className="px-2 py-1.5">
                            <p className="text-[11px] font-medium truncate" title={m.filename}>{m.filename}</p>
                            {sizeMB && <p className="text-[10px] text-muted-foreground">{sizeMB} MB</p>}
                          </div>
                        </div>
                        {/* Selected checkmark overlay */}
                        <div className="absolute top-2 right-2 hidden peer-checked:flex h-5 w-5 rounded-full bg-primary items-center justify-center pointer-events-none shadow-sm">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                        {/* Primary selection - visible only when checked */}
                        <div className="hidden peer-checked:flex items-center gap-1.5 mt-1.5 px-1">
                          <input type="radio" name="primaryMedia" value={m.id} defaultChecked={m.id === primaryMediaId} className="h-3.5 w-3.5 accent-amber-500" />
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span className="text-[10px] text-amber-700 font-medium">Set as Primary</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" className="gap-2">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
          <Link href={`/dashboard/bots/${id}/products`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
