import { gql } from '@apollo/client/core' // use '@apollo/client' in a react-based app

export const GetDelegatedStakingActivities = gql`
  query getDelegatedStakingActivities($delegatorAddress: String) {
    delegated_staking_activities(where: { delegator_address: { _eq: $delegatorAddress } }, order_by: { transaction_version: asc }) {
      amount
      delegator_address
      event_index
      event_type
      pool_address
      transaction_version
    }
  }
`
