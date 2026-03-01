import {ui} from "@/core/ui";
import type {StorefrontNavigationItem} from "@/lib/api";
import {getStorefrontNavigationLocation} from "@/lib/api";

const HomePage = ui("HomePage");

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ locale: string }>;
}) {
    const {locale} = await params;
    let shopItems: StorefrontNavigationItem[] = [];
    try {
        const footerShop = await getStorefrontNavigationLocation("footer_shop", locale);
        shopItems = footerShop?.menu?.items ?? [];
    } catch {
    }

    return <HomePage shopItems={shopItems}/>;
}
