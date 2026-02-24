import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { BotNav } from '@/components/dashboard/bot-nav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { ArrowLeft, Save } from 'lucide-react';

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
    select: { id: true, filename: true, type: true },
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

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>}

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
            <CardDescription>Select photos and videos for this product.</CardDescription>
          </CardHeader>
          <CardContent>
            {mediaLibrary.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No media uploaded yet.{' '}
                <Link href={`/dashboard/bots/${id}/media`} className="text-primary underline">Upload media first</Link>.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Check the media to associate with this product. Select a primary image for the thumbnail.</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[320px] overflow-y-auto p-1">
                  {mediaLibrary.map((m) => (
                    <label key={m.id} className="relative cursor-pointer group">
                      <input
                        type="checkbox"
                        name="media"
                        value={m.id}
                        defaultChecked={associatedMediaIds.has(m.id)}
                        className="peer sr-only"
                      />
                      <div className="h-20 w-full rounded border-2 border-transparent peer-checked:border-primary overflow-hidden bg-muted transition-colors">
                        {m.type === 'VIDEO' ? (
                          <div className="h-full w-full flex items-center justify-center relative">
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <video src={`/api/media/${m.id}`} className="h-full w-full object-cover" muted preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/media/${m.id}`} alt={m.filename} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="hidden peer-checked:flex items-center gap-1 mt-1">
                        <input
                          type="radio"
                          name="primaryMedia"
                          value={m.id}
                          defaultChecked={m.id === primaryMediaId}
                          className="h-3 w-3"
                        />
                        <span className="text-[9px] text-muted-foreground">Primary</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate mt-0.5">{m.filename}</p>
                    </label>
                  ))}
                </div>
              </div>
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
