import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTripStore } from '../store/tripStore'
import { tripsApi, daysApi, placesApi } from '../api/client'
import Navbar from '../components/Layout/Navbar'
import PhotoGallery from '../components/Photos/PhotoGallery'
import { ArrowLeft } from 'lucide-react'

export default function PhotosPage() {
  const { id: tripId } = useParams()
  const navigate = useNavigate()
  const tripStore = useTripStore()

  const [trip, setTrip] = useState(null)
  const [days, setDays] = useState([])
  const [places, setPlaces] = useState([])
  const [photos, setPhotos] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [tripId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [tripData, daysData, placesData] = await Promise.all([
        tripsApi.get(tripId),
        daysApi.list(tripId),
        placesApi.list(tripId),
      ])
      setTrip(tripData.trip)
      setDays(daysData.days)
      setPlaces(placesData.places)

      // Load photos
      await tripStore.loadPhotos(tripId)
    } catch (err) {
      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  // Sync photos from store
  useEffect(() => {
    setPhotos(tripStore.photos)
  }, [tripStore.photos])

  const handleUpload = async (formData) => {
    await tripStore.addPhoto(tripId, formData)
  }

  const handleDelete = async (photoId) => {
    await tripStore.deletePhoto(tripId, photoId)
  }

  const handleUpdate = async (photoId, data) => {
    await tripStore.updatePhoto(tripId, photoId, data)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar tripTitle={trip?.title} tripId={tripId} showBack onBack={() => navigate(`/trips/${tripId}`)} />

      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              to={`/trips/${tripId}`}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück zur Planung
            </Link>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fotos</h1>
              <p className="text-gray-500 text-sm">{photos.length} Fotos für {trip?.title}</p>
            </div>
          </div>

          <PhotoGallery
            photos={photos}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            places={places}
            days={days}
            tripId={tripId}
          />
        </div>
      </div>
    </div>
  )
}
