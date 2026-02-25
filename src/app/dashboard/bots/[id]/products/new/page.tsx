import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { ArrowLeft, Save, Star, Check } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';

export const metadata: Metadata = { title: 'Add Product', robots: { index: false } };

export default async function NewProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  // Media library for selection
  const mediaLibrary = await db.media.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, filename: true, type: true, fileSize: true, mimeType: true },
  });

  async function handleCreateProduct(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      redirect(`/dashboard/bots/${id}/products/new?error=${encodeURIComponent('Product name is required')}`);
    }

    const description = (formData.get('description') as string)?.trim();
    if (!description) {
      redirect(`/dashboard/bots/${id}/products/new?error=${encodeURIComponent('Description is required')}`);
    }

    const advantages = (formData.get('advantages') as string)?.trim();
    if (!advantages) {
      redirect(`/dashboard/bots/${id}/products/new?error=${encodeURIComponent('Advantages are required')}`);
    }

    const targetAudience = (formData.get('targetAudience') as string)?.trim();
    if (!targetAudience) {
      redirect(`/dashboard/bots/${id}/products/new?error=${encodeURIComponent('Target audience is required')}`);
    }

    const buyingReasons = (formData.get('buyingReasons') as string)?.trim();
    if (!buyingReasons) {
      redirect(`/dashboard/bots/${id}/products/new?error=${encodeURIComponent('Buying reasons are required')}`);
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
    const primaryMediaId = (formData.get('primaryMedia') as string) || null;

    // Validate media ownership
    if (selectedMedia.length > 0) {
      const mediaCount = await db.media.count({
        where: { id: { in: selectedMedia }, botId: id },
      });
      if (mediaCount !== selectedMedia.length) {
        redirect(`/dashboard/bots/${id}/products/new?error=${encodeURIComponent('Some selected media not found')}`);
      }
    }

    // Create product + media associations in a transaction
    const product = await db.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          botId: id,
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

      // Create media associations
      if (selectedMedia.length > 0) {
        await tx.productMedia.createMany({
          data: selectedMedia.map((mediaId, index) => ({
            productId: prod.id,
            mediaId,
            sortOrder: index,
            isPrimary: mediaId === primaryMediaId || (index === 0 && !primaryMediaId),
          })),
        });
      }

      return prod;
    });

    redirect(`/dashboard/bots/${id}/products?success=${encodeURIComponent(`Product "${product.name}" created`)}`);
  }

  const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const textareaClass = 'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Add Product</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a product or service for AI to promote in posts.</p>
      </div>

      {sp.error && <AlertMessage type="error" message={sp.error} />}

      <Link href={`/dashboard/bots/${id}/products`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </Link>

      <form action={handleCreateProduct} className="space-y-6">
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
                <input name="name" type="text" required placeholder="e.g. Premium Widget, SEO Service" className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Brand</label>
                <input name="brand" type="text" placeholder="e.g. Acechange, MyBrand" className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <input name="category" type="text" placeholder="e.g. Software, Clothing, Crypto" className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price</label>
                <input name="price" type="text" placeholder="e.g. 29.99 EUR, from $15/month, Free" className={inputClass} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Product URL</label>
              <input name="url" type="url" placeholder="https://example.com/product" className={inputClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
                <HelpTip text="Detailed description of what the product/service is. The more detail you provide, the better AI can create promotional content." />
              </label>
              <textarea name="description" required placeholder="Describe your product or service in detail. What is it? What does it do? What problem does it solve?" className={textareaClass} />
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
                <HelpTip text="List the unique selling points, benefits, and advantages of your product. What makes it better than alternatives?" />
              </label>
              <textarea name="advantages" required placeholder="- Fast and reliable&#10;- No KYC required&#10;- Best exchange rates&#10;- 24/7 support" className={textareaClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Target Audience <span className="text-destructive">*</span>
                <HelpTip text="Describe who buys this product. Demographics, interests, pain points, professions. The more specific, the better AI targets the content." />
              </label>
              <textarea name="targetAudience" required placeholder="e.g. Crypto traders aged 25-45, privacy-conscious individuals, small business owners who need anonymous transactions..." className={textareaClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Why People Should Buy <span className="text-destructive">*</span>
                <HelpTip text="The compelling reasons someone should choose your product. Think about pain points you solve and emotions you trigger." />
              </label>
              <textarea name="buyingReasons" required placeholder="- Protect your financial privacy&#10;- Save money on exchange fees&#10;- No lengthy verification process&#10;- Trusted by 10,000+ users" className={textareaClass} />
            </div>
          </CardContent>
        </Card>

        {/* AI Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>AI Presentation</CardTitle>
            <CardDescription>Tell AI how you want this product promoted on social media.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                AI Instructions
                <HelpTip text="Optional. Tell AI how to present this product. Tone, style, specific phrases to use or avoid, CTA preferences, etc." />
              </label>
              <textarea name="aiInstructions" placeholder="e.g. Use casual tone, emphasize privacy benefits, always include a link to the website, avoid mentioning competitors, use crypto/privacy-related emojis..." className={textareaClass} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Keywords / Tags
                <HelpTip text="Comma-separated keywords related to this product. AI uses these for hashtags and content targeting." />
              </label>
              <input name="keywords" type="text" placeholder="e.g. crypto, bitcoin, privacy, exchange, anonymous" className={inputClass} />
              <p className="text-xs text-muted-foreground">Separate with commas. Used for hashtags and AI content targeting.</p>
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
                        <input type="checkbox" name="media" value={m.id} className="peer sr-only" />
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
                          <input type="radio" name="primaryMedia" value={m.id} className="h-3.5 w-3.5 accent-amber-500" />
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
            <Save className="h-4 w-4" /> Save Product
          </Button>
          <Link href={`/dashboard/bots/${id}/products`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
