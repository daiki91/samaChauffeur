import type { AddressResult } from '../lib/geocode'
import type { Route } from '../lib/routing'
import CompletedCard from './ride-status/CompletedCard'
import BookingForm from './ride-status/BookingForm'
import ScheduledCard from './ride-status/ScheduledCard'
import WaitingCard from './ride-status/WaitingCard'
import DriverFoundCard from './ride-status/DriverFoundCard'
import type { ActiveTrip, Point } from './ride-status/types'

export type { ActiveTrip } from './ride-status/types'
export { VEHICLE_OPTIONS, PAYMENT_OPTIONS } from './ride-status/types'

type Props = {
  activeTrip: ActiveTrip | null
  completedTrip: ActiveTrip | null
  completedPaymentStatus: string | null
  onPayCompleted: (trip: ActiveTrip) => void
  onRateTrip: (trip: ActiveTrip, rating: number, comment?: string) => void
  onSkipRating: (trip: ActiveTrip) => void
  ratingSubmitting: boolean
  driverEtaMin: number | null
  driverRating: { average: number | null; count: number } | null

  // idle booking form (state owned by the parent dashboard, unchanged)
  originText: string
  destinationText: string
  onOriginChange: (v: string) => void
  onOriginSelect: (r: AddressResult) => void
  onDestinationChange: (v: string) => void
  onDestinationSelect: (r: AddressResult) => void
  myPosition: Point | null
  originPoint: Point | null
  stops: { id: string; text: string; point: Point | null }[]
  onAddStop: () => void
  onRemoveStop: (id: string) => void
  onStopTextChange: (id: string, v: string) => void
  onStopSelect: (id: string, r: AddressResult) => void
  maxStops: number
  scheduleEnabled: boolean
  onScheduleToggle: (v: boolean) => void
  scheduledAtInput: string
  onScheduledAtChange: (v: string) => void
  pendingDiscount: { pct: number; label: string } | null
  routeLoading: boolean
  estimate: { price: number; distanceKm: number; priceMin?: number; priceMax?: number } | null
  route: Route | null
  submitting: boolean
  canRequest: boolean
  onSubmit: (e: React.FormEvent) => void
  vehicleType: string
  onVehicleTypeChange: (v: string) => void
  paymentMethod: string
  onPaymentMethodChange: (v: string) => void

  // active trip actions
  onCancel: () => void
  cancelling: boolean
  onChangeActiveVehicleType: (v: string) => void
  changingVehicleType: boolean
  onChangeActivePaymentMethod: (v: string) => void
  changingPaymentMethod: boolean
  onShareTrip: () => void
  sharingTrip: boolean
  onSos: () => void
  sosSubmitting: boolean
}

// Renders one of five completely different cards depending on where the passenger's booking
// currently stands. Each state lives in its own component under ./ride-status/ — this is just
// the switch, so a change to (say) the waiting-for-driver UI never risks touching the others.
export default function RideStatusBar(props: Props) {
  const { activeTrip, completedTrip } = props
  const status = activeTrip?.status

  if (!activeTrip && completedTrip) {
    return (
      <CompletedCard
        completedTrip={completedTrip}
        completedPaymentStatus={props.completedPaymentStatus}
        onPayCompleted={props.onPayCompleted}
        onRateTrip={props.onRateTrip}
        onSkipRating={props.onSkipRating}
        ratingSubmitting={props.ratingSubmitting}
      />
    )
  }

  if (!activeTrip) {
    return (
      <BookingForm
        originText={props.originText}
        destinationText={props.destinationText}
        onOriginChange={props.onOriginChange}
        onOriginSelect={props.onOriginSelect}
        onDestinationChange={props.onDestinationChange}
        onDestinationSelect={props.onDestinationSelect}
        myPosition={props.myPosition}
        originPoint={props.originPoint}
        stops={props.stops}
        onAddStop={props.onAddStop}
        onRemoveStop={props.onRemoveStop}
        onStopTextChange={props.onStopTextChange}
        onStopSelect={props.onStopSelect}
        maxStops={props.maxStops}
        scheduleEnabled={props.scheduleEnabled}
        onScheduleToggle={props.onScheduleToggle}
        scheduledAtInput={props.scheduledAtInput}
        onScheduledAtChange={props.onScheduledAtChange}
        pendingDiscount={props.pendingDiscount}
        routeLoading={props.routeLoading}
        estimate={props.estimate}
        route={props.route}
        submitting={props.submitting}
        canRequest={props.canRequest}
        onSubmit={props.onSubmit}
        vehicleType={props.vehicleType}
        onVehicleTypeChange={props.onVehicleTypeChange}
        paymentMethod={props.paymentMethod}
        onPaymentMethodChange={props.onPaymentMethodChange}
      />
    )
  }

  if (status === 'SCHEDULED') {
    return <ScheduledCard activeTrip={activeTrip} onCancel={props.onCancel} cancelling={props.cancelling} />
  }

  if (status === 'REQUESTED') {
    return (
      <WaitingCard
        activeTrip={activeTrip}
        onChangeActiveVehicleType={props.onChangeActiveVehicleType}
        changingVehicleType={props.changingVehicleType}
        onChangeActivePaymentMethod={props.onChangeActivePaymentMethod}
        changingPaymentMethod={props.changingPaymentMethod}
        onCancel={props.onCancel}
        cancelling={props.cancelling}
      />
    )
  }

  return (
    <DriverFoundCard
      activeTrip={activeTrip}
      driverEtaMin={props.driverEtaMin}
      driverRating={props.driverRating}
      onChangeActivePaymentMethod={props.onChangeActivePaymentMethod}
      changingPaymentMethod={props.changingPaymentMethod}
      onShareTrip={props.onShareTrip}
      sharingTrip={props.sharingTrip}
      onCancel={props.onCancel}
      cancelling={props.cancelling}
      onSos={props.onSos}
      sosSubmitting={props.sosSubmitting}
    />
  )
}
