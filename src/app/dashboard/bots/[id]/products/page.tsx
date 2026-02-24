import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { BotNav } from '@/components/dashboard/bot-nav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Trash2, Eye, EyeOff } from 'lucide-react';

export const metadata: Metadata = { title: 'Products', robots: { index: false } };

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
  });
  if (!bot) notFound();

  const products = await db.product.findMany({
    where: { botId: bot.id },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    include: {
      productMedia: {
        where: { isPrimary: true },
        include: { media: { select: { id: true, filename: true, type: true } } },
        take: 1,
      },
      _count: { select: { productMedia: true, scheduledPosts: true } },
    },
  });

  async function handleDelete(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const productId = formData.get('productId') as string;
    if (!productId) redirect(`/dashboard/bots/${id}/products?error=${encodeURIComponent('Product not found')}`);

    const product = await db.product.findUnique({
      where: { id: productId },
      include: { bot: { select: { userId: true } } },
    });

    if (!product || product.bot.userId !== currentUser.id) {
      redirect(`/dashboard/bots/${id}/products?error=${encodeURIComponent('Product not found')}`);
    }

    await db.product.delete({ where: { id: productId } });
    redirect(`/dashboard/bots/${id}/products?success=${encodeURIComponent('Product deleted')}`);
  }

  async function handleToggleActive(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const productId = formData.get('productId') as string;
    const newActive = formData.get('newActive') === 'true';

    const product = await db.product.findUnique({
      where: { id: productId },
      include: { bot: { select: { userId: true } } },
    });

    if (!product || product.bot.userId !== currentUser.id) {
      redirect(`/dashboard/bots/${id}/products?error=${encodeURIComponent('Product not found')}`);
    }

    await db.product.update({
      where: { id: productId },
      data: { isActive: newActive },
    });

    redirect(`/dashboard/bots/${id}/products?success=${encodeURIComponent(newActive ? 'Product activated' : 'Product deactivated')}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Products</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your products and services. AI uses this info to create targeted promotional posts.
        </p>
        <BotNav botId={id} activeTab="products" />
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? 's' : ''}</p>
        <Link href={`/dashboard/bots/${id}/products/new`}>
          <Button className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No products yet. Add your first product so AI can create targeted promotional posts.</p>
            <Link href={`/dashboard/bots/${id}/products/new`}>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const primaryMedia = product.productMedia[0]?.media;

            return (
              <Card key={product.id} className={!product.isActive ? 'opacity-60' : ''}>
                <CardContent className="p-0">
                  {/* Thumbnail */}
                  <div className="h-40 bg-muted rounded-t-lg overflow-hidden">
                    {primaryMedia ? (
                      primaryMedia.type === 'VIDEO' ? (
                        <div className="relative h-full w-full">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video
                            src={`/api/media/${primaryMedia.id}`}
                            className="h-full w-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/media/${primaryMedia.id}`}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/dashboard/bots/${id}/products/${product.id}`} className="hover:underline">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                        </Link>
                        {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
                      </div>
                      {!product.isActive && <Badge variant="secondary" className="text-[10px] shrink-0">Inactive</Badge>}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {product.category && <Badge variant="outline" className="text-[10px]">{product.category}</Badge>}
                      {product.price && <Badge variant="secondary" className="text-[10px]">{product.price}</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        {product._count.productMedia} media &middot; {product._count.scheduledPosts} post{product._count.scheduledPosts !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-2 border-t">
                      <Link href={`/dashboard/bots/${id}/products/${product.id}`} className="flex-1">
                        <Button variant="ghost" size="sm" className="w-full text-xs">Edit</Button>
                      </Link>
                      <form action={handleToggleActive}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="newActive" value={product.isActive ? 'false' : 'true'} />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title={product.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {product.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </form>
                      <form action={handleDelete}>
                        <input type="hidden" name="productId" value={product.id} />
                        <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
