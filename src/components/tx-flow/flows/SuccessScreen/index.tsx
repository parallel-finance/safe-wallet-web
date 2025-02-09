import StatusStepper from './StatusStepper'
import { Button, Container, Divider, Paper } from '@mui/material'
import classnames from 'classnames'
import Link from 'next/link'
import css from './styles.module.css'
import { useAppSelector } from '@/store'
import { PendingStatus, selectPendingTxById } from '@/store/pendingTxsSlice'
import { useCallback, useContext, useEffect, useState } from 'react'
import { getTxLink } from '@/hooks/useTxNotifications'
import { useCurrentChain } from '@/hooks/useChains'
import { TxEvent, txSubscribe } from '@/services/tx/txEvents'
import useSafeInfo from '@/hooks/useSafeInfo'
import { TxModalContext } from '../..'
import LoadingSpinner, { SpinnerStatus } from '@/components/new-safe/create/steps/StatusStep/LoadingSpinner'
import { ProcessingStatus } from '@/components/tx-flow/flows/SuccessScreen/statuses/ProcessingStatus'
import { IndexingStatus } from '@/components/tx-flow/flows/SuccessScreen/statuses/IndexingStatus'
import { DefaultStatus } from '@/components/tx-flow/flows/SuccessScreen/statuses/DefaultStatus'
import useDecodeTx from '@/hooks/useDecodeTx'
import { isSwapConfirmationViewOrder } from '@/utils/transaction-guards'
import type { SafeTransaction } from '@safe-global/safe-core-sdk-types'

const SuccessScreen = ({ txId, safeTx }: { txId: string; safeTx?: SafeTransaction }) => {
  const [localTxHash, setLocalTxHash] = useState<string>()
  const [error, setError] = useState<Error>()
  const { setTxFlow } = useContext(TxModalContext)
  const chain = useCurrentChain()
  const pendingTx = useAppSelector((state) => selectPendingTxById(state, txId))
  const { safeAddress } = useSafeInfo()
  const { status } = pendingTx || {}
  const txHash = pendingTx && 'txHash' in pendingTx ? pendingTx.txHash : undefined
  const txLink = chain && getTxLink(txId, chain, safeAddress)
  const [decodedData] = useDecodeTx(safeTx)
  const isSwapOrder = isSwapConfirmationViewOrder(decodedData)

  useEffect(() => {
    if (!txHash) return

    setLocalTxHash(txHash)
  }, [txHash])

  useEffect(() => {
    const unsubFns: Array<() => void> = ([TxEvent.FAILED, TxEvent.REVERTED] as const).map((event) =>
      txSubscribe(event, (detail) => {
        if (detail.txId === txId && pendingTx) setError(detail.error)
      }),
    )

    return () => unsubFns.forEach((unsubscribe) => unsubscribe())
  }, [txId, pendingTx])

  const onClose = useCallback(() => {
    setTxFlow(undefined)
  }, [setTxFlow])

  const isSuccess = status === undefined
  const spinnerStatus = error ? SpinnerStatus.ERROR : isSuccess ? SpinnerStatus.SUCCESS : SpinnerStatus.PROCESSING

  let StatusComponent
  switch (status) {
    case PendingStatus.PROCESSING:
    case PendingStatus.RELAYING:
      StatusComponent = <ProcessingStatus txId={txId} pendingTx={pendingTx} />
      break
    case PendingStatus.INDEXING:
      StatusComponent = <IndexingStatus />
      break
    default:
      StatusComponent = <DefaultStatus error={error} />
  }

  return (
    <Container
      component={Paper}
      disableGutters
      sx={{
        textAlign: 'center',
        maxWidth: `${900 - 75}px`, // md={11}
      }}
      maxWidth={false}
    >
      <div className={css.row}>
        <LoadingSpinner status={spinnerStatus} />
        {StatusComponent}
      </div>

      {!error && (
        <>
          <Divider />
          <div className={css.row}>
            <StatusStepper status={status} txHash={localTxHash} />
          </div>
        </>
      )}

      <Divider />

      <div className={classnames(css.row, css.buttons)}>
        {isSwapOrder && (
          <Button data-testid="finish-transaction-btn" variant="outlined" size="small" onClick={onClose}>
            Back to swaps
          </Button>
        )}

        {txLink && (
          <Link {...txLink} passHref target="_blank" rel="noreferrer" legacyBehavior>
            <Button
              data-testid="view-transaction-btn"
              variant={isSwapOrder ? 'contained' : 'outlined'}
              size="small"
              onClick={onClose}
            >
              View transaction
            </Button>
          </Link>
        )}

        {!isSwapOrder && (
          <Button data-testid="finish-transaction-btn" variant="contained" size="small" onClick={onClose}>
            Finish
          </Button>
        )}
      </div>
    </Container>
  )
}

export default SuccessScreen
