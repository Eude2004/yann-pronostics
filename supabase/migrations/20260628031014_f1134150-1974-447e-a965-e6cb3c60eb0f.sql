ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS gateway text;

-- Update existing GeniusPay transactions to reflect the forced gateway
UPDATE public.transactions SET gateway = 'PaiementPro' WHERE payment_method = 'geniuspay' AND gateway IS NULL;